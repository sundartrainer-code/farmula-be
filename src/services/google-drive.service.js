import fs from "node:fs"
import path from "node:path"
import { google } from "googleapis"
import { env } from "../config/env.js"
import { AppError } from "../utils/AppError.js"

const DRIVE_SCOPE = ["https://www.googleapis.com/auth/drive"]
const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder"
const FOLDERS = {
  root: "Formula LMS",
  videos: "Videos",
  thumbnails: "CourseThumbnails",
}

let driveClient = null
let folderCache = null

function diagnosticLoggingEnabled() {
  return env.debugMedia || env.googleDriveDiagnostics
}

function privateKeyPrefix(value = "") {
  return value ? String(value).slice(0, 25) : null
}

function parsedCredentialSummary(credentials, credentialSource) {
  return {
    credentialSource,
    usesGoogleServiceAccountJson: credentialSource.startsWith("GOOGLE_SERVICE_ACCOUNT_JSON"),
    clientEmail: credentials.client_email || null,
    projectId: credentials.project_id || null,
    privateKeyExists: Boolean(credentials.private_key),
    privateKeyPrefix: privateKeyPrefix(credentials.private_key),
    driveFolderId: env.googleDriveFolderId || null,
  }
}

function googleAuthOptions() {
  if (env.googleServiceAccountJson) {
    const configured = env.googleServiceAccountJson.trim()
    const keyFile = path.isAbsolute(configured)
      ? configured
      : path.resolve(process.cwd(), configured)

    if (fs.existsSync(keyFile)) {
      return { keyFile }
    }

    try {
      return { credentials: JSON.parse(configured) }
    } catch {
      throw new AppError("Invalid GOOGLE_SERVICE_ACCOUNT_JSON path or JSON", 500)
    }
  }

  if (env.googleClientEmail && env.googlePrivateKey) {
    return { credentials: {
      project_id: env.googleProjectId,
      client_email: env.googleClientEmail,
      private_key: env.googlePrivateKey,
    } }
  }

  const filePath = path.resolve(process.cwd(), "credentials/formulavideos-c2aa3728d05c.json")
  if (fs.existsSync(filePath)) {
    return { keyFile: filePath }
  }

  throw new AppError("Google Drive credentials are not configured", 500)
}

function googleCredentialSummary() {
  const options = googleAuthOptions()
  if (options.credentials) {
    return {
      credentialSource: "environment credentials",
      serviceAccountEmail: options.credentials.client_email || null,
    }
  }

  if (options.keyFile) {
    try {
      const credentials = JSON.parse(fs.readFileSync(options.keyFile, "utf8"))
      return {
        credentialSource: options.keyFile,
        serviceAccountEmail: credentials.client_email || null,
      }
    } catch {
      return {
        credentialSource: options.keyFile,
        serviceAccountEmail: null,
      }
    }
  }

  return {
    credentialSource: "unknown",
    serviceAccountEmail: null,
  }
}

function googleRuntimeSummary() {
  if (env.googleServiceAccountJson) {
    const configured = env.googleServiceAccountJson.trim()
    const keyFile = path.isAbsolute(configured)
      ? configured
      : path.resolve(process.cwd(), configured)

    if (fs.existsSync(keyFile)) {
      try {
        const credentials = JSON.parse(fs.readFileSync(keyFile, "utf8"))
        return parsedCredentialSummary(credentials, "GOOGLE_SERVICE_ACCOUNT_JSON file")
      } catch {
        return {
          credentialSource: "GOOGLE_SERVICE_ACCOUNT_JSON file",
          usesGoogleServiceAccountJson: true,
          credentialParseError: true,
          driveFolderId: env.googleDriveFolderId || null,
        }
      }
    }

    try {
      const credentials = JSON.parse(configured)
      return parsedCredentialSummary(credentials, "GOOGLE_SERVICE_ACCOUNT_JSON inline")
    } catch {
      return {
        credentialSource: "GOOGLE_SERVICE_ACCOUNT_JSON",
        usesGoogleServiceAccountJson: true,
        credentialParseError: true,
        valueLooksLikePath: configured.includes("/") || configured.endsWith(".json"),
        driveFolderId: env.googleDriveFolderId || null,
      }
    }
  }

  if (env.googleClientEmail && env.googlePrivateKey) {
    return {
      credentialSource: "GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY",
      usesGoogleServiceAccountJson: false,
      clientEmail: env.googleClientEmail || null,
      projectId: env.googleProjectId || null,
      privateKeyExists: Boolean(env.googlePrivateKey),
      privateKeyPrefix: privateKeyPrefix(env.googlePrivateKey),
      driveFolderId: env.googleDriveFolderId || null,
    }
  }

  const filePath = path.resolve(process.cwd(), "credentials/formulavideos-c2aa3728d05c.json")
  if (fs.existsSync(filePath)) {
    try {
      const credentials = JSON.parse(fs.readFileSync(filePath, "utf8"))
      return parsedCredentialSummary(credentials, "local credentials file fallback")
    } catch {
      return {
        credentialSource: "local credentials file fallback",
        credentialParseError: true,
        driveFolderId: env.googleDriveFolderId || null,
      }
    }
  }

  return {
    credentialSource: "none",
    usesGoogleServiceAccountJson: false,
    clientEmail: env.googleClientEmail || null,
    projectId: env.googleProjectId || null,
    privateKeyExists: Boolean(env.googlePrivateKey),
    privateKeyPrefix: privateKeyPrefix(env.googlePrivateKey),
    partialEnvironmentCredentials: Boolean(env.googleClientEmail || env.googlePrivateKey || env.googleProjectId),
    driveFolderId: env.googleDriveFolderId || null,
  }
}

function googleErrorDetails(error) {
  return {
    name: error?.name || null,
    httpStatus: error?.response?.status || error?.status || error?.code || null,
    googleError: error?.response?.data?.error || null,
    googleErrorDescription: error?.response?.data?.error_description || null,
    message: error?.message || null,
    responseData: error?.response?.data || null,
    stack: error?.stack || null,
  }
}

function googleErrorMessage(label, error) {
  const details = googleErrorDetails(error)
  const reason = details.googleErrorDescription || details.googleError || details.message || "Unknown Google Drive error"
  return `Google Drive ${label} failed: ${reason}`
}

function logGoogleCall(label, extra = {}) {
  if (!diagnosticLoggingEnabled()) return
  console.log("[google-drive:request]", {
    operation: label,
    ...extra,
    credentials: googleRuntimeSummary(),
  })
}

function logGoogleError(label, error, extra = {}) {
  console.error("[google-drive:error]", {
    operation: label,
    ...extra,
    credentials: googleRuntimeSummary(),
    error: googleErrorDetails(error),
  })
}

async function googleCall(label, callback, extra = {}) {
  logGoogleCall(label, extra)
  try {
    return await callback()
  } catch (error) {
    logGoogleError(label, error, extra)
    const statusCode = error?.response?.status || error?.status || 502
    throw new AppError(googleErrorMessage(label, error), statusCode, error?.code || statusCode)
  }
}

function drive() {
  if (driveClient) return driveClient

  const auth = new google.auth.GoogleAuth({
    ...googleAuthOptions(),
    scopes: DRIVE_SCOPE,
  })

  driveClient = google.drive({ version: "v3", auth })
  return driveClient
}

function isVideoMimeType(mimeType = "") {
  return mimeType.startsWith("video/")
}

function escapeQueryValue(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'")
}

async function findFolder(name, parentId = null) {
  const parentQuery = parentId ? `'${escapeQueryValue(parentId)}' in parents` : "'root' in parents"
  const response = await googleCall("findFolder", () => drive().files.list({
    q: [
      `name='${escapeQueryValue(name)}'`,
      `mimeType='${FOLDER_MIME_TYPE}'`,
      "trashed=false",
      parentQuery,
    ].join(" and "),
    fields: "files(id,name)",
    spaces: "drive",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  }), { name, parentId })

  return response.data.files?.[0] || null
}

async function createFolder(name, parentId = null) {
  const response = await googleCall("createFolder", () => drive().files.create({
    requestBody: {
      name,
      mimeType: FOLDER_MIME_TYPE,
      ...(parentId ? { parents: [parentId] } : {}),
    },
    fields: "id,name",
    supportsAllDrives: true,
  }), { name, parentId })

  return response.data
}

async function findOrCreateFolder(name, parentId = null) {
  return (await findFolder(name, parentId)) || createFolder(name, parentId)
}

async function getFolderMetadata(folderId) {
  const response = await googleCall("getFolderMetadata", () => drive().files.get({
    fileId: folderId,
    fields: "id,name,mimeType,parents",
    supportsAllDrives: true,
  }), { folderId })
  return response.data
}

async function ensureFolders() {
  if (folderCache) return folderCache

  const configuredFolder = env.googleDriveFolderId
    ? await getFolderMetadata(env.googleDriveFolderId)
    : null

  if (configuredFolder && configuredFolder.mimeType !== FOLDER_MIME_TYPE) {
    throw new AppError("GOOGLE_DRIVE_FOLDER_ID must point to a Google Drive folder", 500)
  }

  const configuredFolderIsVideoSource = Boolean(configuredFolder)
  const rootFolder = configuredFolder && !configuredFolderIsVideoSource
    ? configuredFolder
    : await findOrCreateFolder(FOLDERS.root)

  const videosFolder = configuredFolderIsVideoSource
    ? configuredFolder
    : await findOrCreateFolder(FOLDERS.videos, rootFolder.id)
  const thumbnailsFolder = await findOrCreateFolder(FOLDERS.thumbnails, rootFolder.id)

  folderCache = {
    root: rootFolder.id,
    videos: videosFolder.id,
    thumbnails: thumbnailsFolder.id,
  }

  if (diagnosticLoggingEnabled()) {
    console.log("[videos:google-drive:folders]", {
      configuredRootFolderId: env.googleDriveFolderId || null,
      configuredFolder: configuredFolder
        ? {
            id: configuredFolder.id,
            name: configuredFolder.name,
            mimeType: configuredFolder.mimeType,
            parents: configuredFolder.parents || [],
          }
        : null,
      resolvedFolderNames: {
        root: rootFolder.name,
        videos: videosFolder.name,
        thumbnails: FOLDERS.thumbnails,
      },
      resolvedFolders: folderCache,
    })
  }

  return folderCache
}

export const googleDriveService = {
  async logConfiguredFolderDiagnostics() {
    const folderId = env.googleDriveFolderId
    if (!diagnosticLoggingEnabled()) return

    console.log("[google-drive:startup:config]", {
      configuredFolderId: folderId || null,
      credentials: googleRuntimeSummary(),
    })

    if (!folderId) {
      console.log("[google-drive:startup:skip]", {
        reason: "GOOGLE_DRIVE_FOLDER_ID is not configured",
      })
      return
    }

    try {
      const metadataResponse = await googleCall("startupFolderMetadata", () => drive().files.get({
        fileId: folderId,
        fields: "id,name,mimeType,parents,owners(emailAddress,displayName),shared,permissions(id,type,emailAddress,role,displayName,deleted)",
        supportsAllDrives: true,
      }), { folderId })
      const folder = metadataResponse.data
      console.log("[google-drive:startup:folder]", {
        folderId: folder.id,
        folderName: folder.name,
        mimeType: folder.mimeType,
        parents: folder.parents || [],
        owners: folder.owners || [],
        shared: folder.shared,
        permissions: folder.permissions || [],
      })

      const query = [
        `'${escapeQueryValue(folderId)}' in parents`,
        "trashed=false",
      ].join(" and ")
      const filesResponse = await googleCall("startupFolderFiles", () => drive().files.list({
        q: query,
        fields: "files(id,name,mimeType,parents,size,createdTime,modifiedTime)",
        spaces: "drive",
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        pageSize: 1000,
      }), { folderId, query })
      const files = filesResponse.data.files || []
      console.log("[google-drive:startup:folder-files]", {
        folderId,
        query,
        count: files.length,
        files: files.map((file) => ({
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          parents: file.parents || [],
          size: file.size || null,
        })),
      })
    } catch (error) {
      console.error("[google-drive:startup:error]", {
        folderId,
        credentials: googleRuntimeSummary(),
        error: googleErrorDetails(error),
      })
    }
  },

  async ensureFolderStructure() {
    return ensureFolders()
  },

  async listVideos() {
    if (diagnosticLoggingEnabled()) {
      console.log("[videos:google-drive:enter]", {
        service: "googleDriveService.listVideos",
        credentials: googleRuntimeSummary(),
      })
    }
    const folders = await ensureFolders()
    const query = [
      `'${escapeQueryValue(folders.videos)}' in parents`,
      "trashed=false",
    ].join(" and ")
    if (diagnosticLoggingEnabled()) {
      console.log("[videos:google-drive:query]", {
        videosFolderId: folders.videos,
        query,
      })
    }
    const response = await googleCall("listVideos", () => drive().files.list({
      q: query,
      fields: "files(id,name,mimeType,parents,size,createdTime,modifiedTime,thumbnailLink,videoMediaMetadata)",
      spaces: "drive",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      orderBy: "createdTime desc",
      pageSize: 1000,
    }), { videosFolderId: folders.videos, query })

    const rawFiles = response.data.files || []
    if (diagnosticLoggingEnabled()) {
      console.log("[videos:google-drive:raw-files]", {
        videosFolderId: folders.videos,
        rawCount: rawFiles.length,
        files: rawFiles.map((file) => ({
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          parents: file.parents || [],
        })),
      })
    }

    const files = rawFiles.filter((file) => isVideoMimeType(file.mimeType))
    if (diagnosticLoggingEnabled()) {
      console.log("[videos:google-drive]", {
        videosFolderId: folders.videos,
        returnedCount: files.length,
        files: files.map((file) => ({
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          parents: file.parents || [],
        })),
      })
    }
    return files
  },

  async uploadVideo({ filePath, filename, mimeType }) {
    const folders = await ensureFolders()
    const response = await googleCall("uploadVideo", () => drive().files.create({
      requestBody: {
        name: filename,
        mimeType,
        parents: [folders.videos],
      },
      media: {
        mimeType,
        body: fs.createReadStream(filePath),
      },
      fields: "id,name,mimeType,size,webViewLink",
      supportsAllDrives: true,
    }), { filename, mimeType, videosFolderId: folders.videos })

    return response.data
  },

  async streamFile(fileId, range) {
    const headers = range ? { Range: range } : undefined
    return googleCall("streamFile", () => drive().files.get(
      { fileId, alt: "media", supportsAllDrives: true },
      { responseType: "stream", headers },
    ), { fileId, range: range || null })
  },

  async metadata(fileId) {
    const response = await googleCall("metadata", () => drive().files.get({
      fileId,
      fields: "id,name,mimeType,size",
      supportsAllDrives: true,
    }), { fileId })
    return response.data
  },

  async deleteFile(fileId) {
    try {
      await googleCall("deleteFile", () => drive().files.delete({ fileId, supportsAllDrives: true }), { fileId })
    } catch (error) {
      if (error?.code !== 404) throw error
    }
  },
}
