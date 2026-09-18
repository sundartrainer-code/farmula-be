import { lessonRepository } from "../repositories/lesson.repository.js"
import { storageRepository } from "../repositories/storage.repository.js"
import { env } from "../config/env.js"
import { googleDriveSyncService } from "./google-drive-sync.service.js"

let lastSuccessfulSyncAt = 0
let activeSync = null

function videoItemFromLesson(lesson) {
  const progress = lesson.progress?.[0]
  const durationSeconds = Number(lesson.durationSeconds || 0)
  const watchedSeconds = Math.min(durationSeconds || Number.MAX_SAFE_INTEGER, Number(progress?.currentTime || 0))
  const thumbnailUrl = lesson.thumbnailUrl
    || (lesson.videoProvider === "youtube" && lesson.youtubeVideoId
      ? `https://i.ytimg.com/vi/${lesson.youtubeVideoId}/hqdefault.jpg`
      : null)
  return {
    id: lesson.id,
    courseId: lesson.courseId,
    googleDriveFileId: lesson.googleDriveFileId,
    videoProvider: lesson.videoProvider,
    youtubeVideoId: lesson.youtubeVideoId,
    title: lesson.title,
    lessonNumber: lesson.lessonNumber,
    sortOrder: lesson.sortOrder,
    isIntroduction: lesson.isIntroduction,
    thumbnailUrl,
    durationSeconds,
    durationFormatted: lesson.durationFormatted,
    watchedSeconds,
    progressPercent: durationSeconds ? Math.min(100, Math.round((watchedSeconds / durationSeconds) * 100)) : 0,
    courseName: lesson.course.title,
    lastWatchedAt: progress?.updatedAt || null,
    completed: Boolean(progress?.completed),
    source: lesson.videoProvider === "youtube" ? "youtube" : "neon-google-drive-sync",
  }
}

export const videoLibraryService = {
  async list(userId) {
    const now = Date.now()
    const syncIntervalMs = Math.max(0, env.googleDriveSyncIntervalSeconds) * 1000
    const activeYoutubeCount = await lessonRepository.countActiveYoutube()
    const shouldSync = activeYoutubeCount === 0 && (!lastSuccessfulSyncAt || now - lastSuccessfulSyncAt >= syncIntervalMs)
    let sync = null

    if (shouldSync) {
      if (!activeSync) {
        activeSync = googleDriveSyncService.syncVideos()
          .then((summary) => {
            lastSuccessfulSyncAt = Date.now()
            return summary
          })
          .finally(() => {
            activeSync = null
          })
      }
      sync = await activeSync
    }

    const [lessons, neonVideoRecords] = await Promise.all([
      lessonRepository.findAllSyncedActive(userId),
      storageRepository.findAll(),
    ])

    const videos = lessons.map(videoItemFromLesson)

    if (env.debugMedia) {
      console.log("[videos:returning]", {
        source: "neon-google-drive-sync",
        count: videos.length,
        activeYoutubeCount,
        syncSkipped: !sync,
        syncedLessonRecordCount: lessons.length,
        courseVideoRecordCount: neonVideoRecords.length,
        ...(sync ? {
          sync: {
            googleDriveVideoCount: sync.googleDriveVideoCount,
            lessonsCreated: sync.created.length,
            lessonsUpdated: sync.updated.length,
            lessonsRenamed: sync.renamed.length,
            lessonsInactivated: sync.inactivated.length,
            neonLessonCountAfterSync: sync.neonLessonCountAfterSync,
          },
        } : {}),
      })
    }

    return videos
  },
}
