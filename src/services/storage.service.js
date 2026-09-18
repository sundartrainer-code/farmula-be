import fs from "node:fs/promises"
import crypto from "node:crypto"
import { PassThrough } from "node:stream"
import { courseRepository } from "../repositories/course.repository.js"
import { storageRepository } from "../repositories/storage.repository.js"
import { AppError } from "../utils/AppError.js"
import { env } from "../config/env.js"
import { googleDriveService } from "./google-drive.service.js"

const MAX_VIDEO_SIZE = 5 * 1024 * 1024 * 1024
const STREAM_TOKEN_TTL_SECONDS = 900
const ALLOWED_MIME_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/x-matroska",
  "video/webm",
])
const ALLOWED_EXTENSIONS = new Set([".mp4", ".mov", ".mkv", ".webm"])
const EXECUTABLE_EXTENSIONS = new Set([".exe", ".bat", ".cmd", ".com", ".sh", ".msi", ".app", ".dmg"])

function extensionOf(filename = "") {
  const index = filename.lastIndexOf(".")
  return index >= 0 ? filename.slice(index).toLowerCase() : ""
}

function validateUpload(file) {
  if (!file) throw new AppError("Video file is required", 400)
  const extension = extensionOf(file.originalname)
  if (EXECUTABLE_EXTENSIONS.has(extension)) throw new AppError("Executable files are not allowed", 400)
  if (!ALLOWED_EXTENSIONS.has(extension) || !ALLOWED_MIME_TYPES.has(file.mimetype)) {
    throw new AppError("Unsupported video format", 400)
  }
  if (file.size < 1) throw new AppError("Uploaded file is empty", 400)
  if (file.size > MAX_VIDEO_SIZE) throw new AppError("Video file exceeds 5GB limit", 400)
}

function serialize(video) {
  return {
    id: video.id,
    courseId: video.courseId,
    googleDriveFileId: video.googleDriveFileId,
    filename: video.filename,
    mimeType: video.mimeType,
    size: Number(video.size),
    uploadedAt: video.uploadedAt,
    publicUrl: `/api/storage/video/${video.googleDriveFileId}`,
  }
}

async function removeTempFile(file) {
  if (!file?.path) return
  try {
    await fs.unlink(file.path)
  } catch {
    // Temp cleanup should not mask the actual upload result.
  }
}

async function assertCourse(courseId) {
  if (!courseId) throw new AppError("courseId is required", 400)
  const course = await courseRepository.findById(courseId)
  if (!course) throw new AppError("Course not found", 404)
  return course
}

function mapGoogleError(error) {
  if (error instanceof AppError) return error
  const status = error?.code || error?.response?.status
  if (status === 401) return new AppError("Google Drive credentials expired or invalid", 502)
  if (status === 403) return new AppError("Google Drive permission denied or quota exceeded", 502)
  if (status === 404) return new AppError("Google Drive file not found", 404)
  return new AppError("Google Drive operation failed", 502)
}

function streamSecret() {
  return env.googlePrivateKey || env.firebasePrivateKey || env.razorpayKeySecret
}

function streamToken(fileId, expires) {
  return crypto
    .createHmac("sha256", streamSecret())
    .update(`${fileId}|${expires}`)
    .digest("base64url")
}

function verifyStreamToken(fileId, expires, token) {
  if (!fileId || !expires || !token) return false
  if (Number(expires) < Math.floor(Date.now() / 1000)) return false
  const expected = streamToken(fileId, expires)
  const expectedBuffer = Buffer.from(expected)
  const tokenBuffer = Buffer.from(token)
  return expectedBuffer.length === tokenBuffer.length
    && crypto.timingSafeEqual(expectedBuffer, tokenBuffer)
}

function apiOrigin(req) {
  const protocol = req.get("x-forwarded-proto") || req.protocol
  return `${protocol}://${req.get("host")}`
}

function safeInlineFilename(filename = "video.mp4") {
  return String(filename).replace(/["\r\n]/g, "").trim() || "video.mp4"
}

function contentDisposition(filename) {
  const fallback = "video.mp4"
  return `inline; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}

function parseRangeHeader(range, size) {
  if (!range) return null
  const match = /^bytes=(\d*)-(\d*)$/.exec(range)
  if (!match) throw new AppError("Invalid Range header", 416)
  if (match[1] === "" && match[2] === "") throw new AppError("Invalid Range header", 416)

  let start
  let end
  if (match[1] === "") {
    const suffixLength = Number(match[2])
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) throw new AppError("Invalid Range header", 416)
    start = Math.max(0, size - suffixLength)
    end = size - 1
  } else {
    start = Number(match[1])
    end = match[2] === "" ? size - 1 : Number(match[2])
  }

  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || start >= size) {
    throw new AppError("Requested range not satisfiable", 416)
  }

  return { start, end: Math.min(end, size - 1) }
}

function inspectFirstBytes(fileId, routeName) {
  const inspector = new PassThrough()
  let firstBytes = Buffer.alloc(0)
  inspector.on("data", (chunk) => {
    if (firstBytes.length >= 32) return
    firstBytes = Buffer.concat([firstBytes, chunk]).subarray(0, 32)
    if (firstBytes.length >= 32) {
      if (env.debugMedia) {
        console.log("[storage:video:first-bytes]", {
          route: routeName,
          fileId,
          first32Hex: firstBytes.toString("hex"),
          first32Ascii: firstBytes.toString("latin1"),
        })
      }
    }
  })
  inspector.on("end", () => {
    if (firstBytes.length && firstBytes.length < 32) {
      if (env.debugMedia) {
        console.log("[storage:video:first-bytes]", {
          route: routeName,
          fileId,
          firstBytes: firstBytes.length,
          first32Hex: firstBytes.toString("hex"),
          first32Ascii: firstBytes.toString("latin1"),
        })
      }
    }
  })
  return inspector
}

function logStreamLifecycle({ route, fileId, reqRange, driveRange, source, inspector, res }) {
  if (!env.debugMedia) return
  const startedAt = Date.now()
  let sequence = 0
  let firstEvent = null
  function log(event, details = {}) {
    sequence += 1
    if (!firstEvent) firstEvent = event
    console.log("[storage:video:lifecycle]", {
      route,
      fileId,
      event,
      firstEvent,
      sequence,
      elapsedMs: Date.now() - startedAt,
      reqRange: reqRange || null,
      driveRange: driveRange || null,
      resWritableEnded: res.writableEnded,
      resWritableFinished: res.writableFinished,
      resDestroyed: res.destroyed,
      headersSent: res.headersSent,
      ...details,
    })
  }

  source.on("end", () => log("stream.end"))
  source.on("close", () => log("stream.close"))
  source.on("error", (error) => log("stream.error", { message: error?.message || null, code: error?.code || null }))
  inspector.on("end", () => log("inspect.end"))
  inspector.on("close", () => log("inspect.close"))
  inspector.on("error", (error) => log("inspect.error", { message: error?.message || null, code: error?.code || null }))
  res.on("finish", () => log("res.finish"))
  res.on("close", () => log("res.close"))
  res.req?.on?.("aborted", () => log("req.aborted"))
  res.req?.on?.("close", () => log("req.close", { requestAborted: Boolean(res.req?.aborted) }))
}

export const storageService = {
  async upload({ courseId, file }) {
    try {
      validateUpload(file)
      await assertCourse(courseId)
      await googleDriveService.ensureFolderStructure()
      const driveFile = await googleDriveService.uploadVideo({
        filePath: file.path,
        filename: file.originalname,
        mimeType: file.mimetype,
      })

      const video = await storageRepository.create({
        courseId,
        googleDriveFileId: driveFile.id,
        filename: driveFile.name || file.originalname,
        mimeType: driveFile.mimeType || file.mimetype,
        size: BigInt(driveFile.size || file.size),
      })

      return serialize(video)
    } catch (error) {
      throw mapGoogleError(error)
    } finally {
      await removeTempFile(file)
    }
  },

  async byCourse(courseId) {
    await assertCourse(courseId)
    const video = await storageRepository.findByCourseId(courseId)
    if (!video) throw new AppError("Course video not found", 404)
    return serialize(video)
  },

  async streamLink({ fileId, req }) {
    const video = await storageRepository.findByFileId(fileId)
    const metadata = video ? null : await googleDriveService.metadata(fileId)
    if (!video && !metadata) throw new AppError("Video file not found", 404)

    const expires = Math.floor(Date.now() / 1000) + STREAM_TOKEN_TTL_SECONDS
    return {
      url: `${apiOrigin(req)}/api/storage/video/${fileId}?expires=${expires}&token=${streamToken(fileId, expires)}`,
      expiresAt: new Date(expires * 1000).toISOString(),
    }
  },

  async stream({ fileId, range, token, expires, method = "GET" }, res) {
    if (!verifyStreamToken(fileId, expires, token)) {
      throw new AppError("Video link expired", 403)
    }

    const video = await storageRepository.findByFileId(fileId)
    const metadata = video ? null : await googleDriveService.metadata(fileId)
    if (!video && !metadata) throw new AppError("Video file not found", 404)

    const size = Number(video?.size ?? metadata?.size ?? 0)
    if (!Number.isFinite(size) || size <= 0) throw new AppError("Video file size is not available", 502)

    const parsedRange = parseRangeHeader(range, size)
    const driveRange = parsedRange ? `bytes=${parsedRange.start}-${parsedRange.end}` : undefined
    const status = parsedRange ? 206 : 200
    const contentLength = parsedRange ? parsedRange.end - parsedRange.start + 1 : size
    const contentType = video?.mimeType || metadata?.mimeType || "video/mp4"
    const filename = safeInlineFilename(video?.filename || metadata?.name || `${fileId}.mp4`)

    try {
      res.status(status)
      res.setHeader("Accept-Ranges", "bytes")
      res.setHeader("Cache-Control", "private, max-age=60")
      res.setHeader("Content-Type", contentType)
      res.setHeader("Content-Length", String(contentLength))
      res.setHeader("Content-Disposition", contentDisposition(filename))
      if (parsedRange) res.setHeader("Content-Range", `bytes ${parsedRange.start}-${parsedRange.end}/${size}`)

      if (method === "HEAD") {
        if (env.debugMedia) {
          console.log("[storage:video:stream]", {
            fileId,
            method,
            requestRange: range || null,
            driveRange: null,
            status,
          })
        }
        res.end()
        return
      }

      const response = await googleDriveService.streamFile(fileId, driveRange)
      const headers = response.headers || {}
      if (headers["content-type"]) res.setHeader("Content-Type", headers["content-type"])

      if (env.debugMedia) {
        console.log("[storage:video:stream]", {
          fileId,
          method,
          requestRange: range || null,
          driveRange: driveRange || null,
          googleStatus: response.status || null,
          status,
        })
      }

      response.data.on("error", () => {
        if (!res.headersSent) res.status(502).end()
        else res.destroy()
      })
      if (env.debugMedia) {
        const inspector = inspectFirstBytes(fileId, "/api/storage/video")
        logStreamLifecycle({
          route: "/api/storage/video",
          fileId,
          reqRange: range,
          driveRange,
          source: response.data,
          inspector,
          res,
        })
        response.data.pipe(inspector).pipe(res)
      } else {
        response.data.pipe(res)
      }
    } catch (error) {
      if (error.statusCode === 416) {
        res.setHeader("Content-Range", `bytes */${size}`)
      }
      throw mapGoogleError(error)
    }
  },

  async testStream({ fileId, range }, res) {
    const video = await storageRepository.findByFileId(fileId)
    const metadata = video ? null : await googleDriveService.metadata(fileId)
    if (!video && !metadata) throw new AppError("Video file not found", 404)

    const size = Number(video?.size ?? metadata?.size ?? 0)
    if (!Number.isFinite(size) || size <= 0) throw new AppError("Video file size is not available", 502)

    const parsedRange = parseRangeHeader(range, size)
    const driveRange = parsedRange ? `bytes=${parsedRange.start}-${parsedRange.end}` : undefined
    const status = parsedRange ? 206 : 200
    const contentLength = parsedRange ? parsedRange.end - parsedRange.start + 1 : size
    const contentType = video?.mimeType || metadata?.mimeType || "video/mp4"
    const filename = safeInlineFilename(video?.filename || metadata?.name || `${fileId}.mp4`)
    const response = await googleDriveService.streamFile(fileId, driveRange)
    const headers = response.headers || {}

    res.status(status)
    res.setHeader("Accept-Ranges", "bytes")
    res.setHeader("Cache-Control", "private, max-age=60")
    res.setHeader("Content-Type", headers["content-type"] || contentType)
    res.setHeader("Content-Length", String(contentLength))
    res.setHeader("Content-Disposition", contentDisposition(filename))
    if (parsedRange) res.setHeader("Content-Range", `bytes ${parsedRange.start}-${parsedRange.end}/${size}`)

    if (env.debugMedia) {
      console.log("[storage:video:test-stream]", {
        fileId,
        requestRange: range || null,
        driveRange: driveRange || null,
        googleStatus: response.status || null,
        status,
      })
    }

    if (env.debugMedia) {
      const inspector = inspectFirstBytes(fileId, "/api/storage/video-test")
      logStreamLifecycle({
        route: "/api/storage/video-test",
        fileId,
        reqRange: range,
        driveRange,
        source: response.data,
        inspector,
        res,
      })
      response.data.pipe(inspector).pipe(res)
    } else {
      response.data.pipe(res)
    }
  },

  async delete(fileId) {
    const video = await storageRepository.findByFileId(fileId)
    if (!video) throw new AppError("Video file not found", 404)

    try {
      await googleDriveService.deleteFile(fileId)
      await storageRepository.deleteByFileId(fileId)
      return { success: true }
    } catch (error) {
      throw mapGoogleError(error)
    }
  },

  async replace({ courseId, file }) {
    validateUpload(file)
    await assertCourse(courseId)
    const existing = await storageRepository.findByCourseId(courseId)

    if (existing) {
      await googleDriveService.deleteFile(existing.googleDriveFileId)
      await storageRepository.deleteByFileId(existing.googleDriveFileId)
    }

    return this.upload({ courseId, file })
  },
}
