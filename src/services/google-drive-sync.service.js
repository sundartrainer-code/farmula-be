import { prisma } from "../config/prisma.js"
import { env } from "../config/env.js"
import { googleDriveService } from "./google-drive.service.js"
import { formatDuration, lessonMetadataService } from "./lesson-metadata.service.js"

const DEFAULT_COURSE = {
  title: "Formula Video Library",
  description: "Google Drive synchronized video lessons.",
}

function driveDurationSeconds(file) {
  return Math.max(0, Math.round(Number(file.videoMediaMetadata?.durationMillis || 0) / 1000))
}

function changedFields(existing, next) {
  return Object.fromEntries(
    Object.entries(next).filter(([key, value]) => existing[key] !== value),
  )
}

function normalizeTitle(value = "") {
  return value
    .replace(/^copy of\s+/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

async function uniqueSlug(tx, desiredSlug, existingLessonId = null) {
  let candidate = desiredSlug
  let index = 1
  while (await tx.lesson.findFirst({
    where: {
      slug: candidate,
      ...(existingLessonId ? { id: { not: existingLessonId } } : {}),
    },
    select: { id: true },
  })) {
    index += 1
    candidate = `${desiredSlug}-${index}`
  }
  return candidate
}

async function ensureCourse(tx) {
  return tx.course.findFirst({ orderBy: { createdAt: "asc" } })
    || tx.course.create({ data: DEFAULT_COURSE })
}

export const googleDriveSyncService = {
  async syncVideos() {
    const driveFiles = await googleDriveService.listVideos()
    const driveFileIds = new Set(driveFiles.map((file) => file.id))

    const summary = await prisma.$transaction(async (tx) => {
      const course = await ensureCourse(tx)
      const existingDriveLessons = await tx.lesson.findMany({
        where: { googleDriveFileId: { not: null }, videoProvider: "google_drive" },
        orderBy: { sortOrder: "asc" },
      })
      const reusableLessons = await tx.lesson.findMany({
        where: { googleDriveFileId: null, videoProvider: "google_drive", isDeleted: false },
        orderBy: { sortOrder: "asc" },
      })
      const existingByDriveId = new Map(existingDriveLessons.map((lesson) => [lesson.googleDriveFileId, lesson]))
      const reusableByTitle = new Map(reusableLessons.map((lesson) => [normalizeTitle(lesson.title), lesson]))
      const reusableByLessonNumber = new Map(
        reusableLessons
          .filter((lesson) => lesson.lessonNumber !== null)
          .map((lesson) => [lesson.lessonNumber, lesson]),
      )

      const summary = {
        googleDriveVideoCount: driveFiles.length,
        neonLessonCountBeforeSync: existingDriveLessons.length,
        created: [],
        updated: [],
        renamed: [],
        inactivated: [],
        skipped: [],
        neonLessonCountAfterSync: 0,
      }

      for (const [index, file] of driveFiles.entries()) {
        const parsed = lessonMetadataService.parse(file.name || file.id)
        const durationSeconds = driveDurationSeconds(file)
        const nextLesson = {
          courseId: course.id,
          title: parsed.title,
          slug: parsed.slug,
          googleDriveFileId: file.id,
          videoProvider: "google_drive",
          youtubeVideoId: null,
          sortOrder: parsed.sortOrder || index + 1,
          lessonNumber: parsed.lessonNumber,
          isIntroduction: parsed.isIntroduction,
          durationSeconds,
          durationFormatted: formatDuration(durationSeconds),
          published: true,
          isDeleted: false,
          deletedAt: null,
        }
        let existing = existingByDriveId.get(file.id)
        let reusableLesson = reusableByTitle.get(normalizeTitle(nextLesson.title))
          || (nextLesson.lessonNumber !== null ? reusableByLessonNumber.get(nextLesson.lessonNumber) : null)

        if (existing && reusableLesson && existing.id !== reusableLesson.id) {
          await tx.lesson.update({
            where: { id: existing.id },
            data: {
              googleDriveFileId: null,
              published: false,
              isDeleted: true,
              deletedAt: new Date(),
            },
          })
          summary.inactivated.push({
            id: existing.id,
            googleDriveFileId: file.id,
            title: existing.title,
          })
          existingByDriveId.delete(file.id)
          existing = null
        }

        nextLesson.slug = await uniqueSlug(tx, nextLesson.slug, existing?.id || reusableLesson?.id || null)

        if (!existing && reusableLesson) {
          const data = changedFields(reusableLesson, nextLesson)
          const updated = await tx.lesson.update({ where: { id: reusableLesson.id }, data })
          existingByDriveId.set(file.id, updated)
          reusableByTitle.delete(normalizeTitle(nextLesson.title))
          if (nextLesson.lessonNumber !== null) reusableByLessonNumber.delete(nextLesson.lessonNumber)
          summary.updated.push({ id: updated.id, googleDriveFileId: file.id, title: updated.title })
          if (reusableLesson.title !== nextLesson.title) {
            summary.renamed.push({
              id: updated.id,
              googleDriveFileId: file.id,
              from: reusableLesson.title,
              to: nextLesson.title,
            })
          }
        } else if (!existing) {
          const created = await tx.lesson.create({ data: nextLesson })
          summary.created.push({ id: created.id, googleDriveFileId: file.id, title: created.title })
        } else {
          const data = changedFields(existing, nextLesson)
          if (Object.keys(data).length) {
            const updated = await tx.lesson.update({ where: { id: existing.id }, data })
            summary.updated.push({ id: updated.id, googleDriveFileId: file.id, title: updated.title })
            if (existing.title !== nextLesson.title) {
              summary.renamed.push({
                id: updated.id,
                googleDriveFileId: file.id,
                from: existing.title,
                to: nextLesson.title,
              })
            }
          } else {
            summary.skipped.push({ id: existing.id, googleDriveFileId: file.id, title: existing.title })
          }
        }

        await tx.courseVideo.upsert({
          where: { googleDriveFileId: file.id },
          update: {
            courseId: course.id,
            filename: file.name || file.id,
            mimeType: file.mimeType || "video/mp4",
            size: BigInt(file.size || 0),
          },
          create: {
            courseId: course.id,
            googleDriveFileId: file.id,
            filename: file.name || file.id,
            mimeType: file.mimeType || "video/mp4",
            size: BigInt(file.size || 0),
          },
        })
      }

      const staleLessons = existingDriveLessons.filter((lesson) => !driveFileIds.has(lesson.googleDriveFileId))
      for (const lesson of staleLessons) {
        if (!lesson.isDeleted || lesson.published) {
          const updated = await tx.lesson.update({
            where: { id: lesson.id },
            data: {
              published: false,
              isDeleted: true,
              deletedAt: new Date(),
            },
          })
          summary.inactivated.push({
            id: updated.id,
            googleDriveFileId: updated.googleDriveFileId,
            title: updated.title,
          })
        }
      }

      await tx.courseVideo.deleteMany({
        where: {
          googleDriveFileId: { notIn: [...driveFileIds] },
        },
      })

      summary.neonLessonCountAfterSync = await tx.lesson.count({
        where: { googleDriveFileId: { not: null }, isDeleted: false, published: true },
      })

      if (env.debugMedia) {
        console.log("[videos:sync:summary]", {
          googleDriveVideoCount: summary.googleDriveVideoCount,
          neonLessonCountBeforeSync: summary.neonLessonCountBeforeSync,
          lessonsCreated: summary.created.length,
          lessonsUpdated: summary.updated.length,
          lessonsRenamed: summary.renamed.length,
          lessonsInactivated: summary.inactivated.length,
          lessonsSkipped: summary.skipped.length,
          neonLessonCountAfterSync: summary.neonLessonCountAfterSync,
        })
      }

      return summary
    }, { timeout: 30000 })

    return summary
  },
}
