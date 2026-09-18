import { courseRepository } from "../repositories/course.repository.js"
import { lessonRepository } from "../repositories/lesson.repository.js"
import { progressRepository } from "../repositories/progress.repository.js"
import { AppError } from "../utils/AppError.js"
import { requireFields } from "../utils/validators.js"
import { googleDriveService } from "./google-drive.service.js"
import { formatDuration, lessonMetadataService } from "./lesson-metadata.service.js"

function publicLesson(lesson) {
  const thumbnailUrl = lesson.thumbnailUrl
    || (lesson.videoProvider === "youtube" && lesson.youtubeVideoId
      ? `https://i.ytimg.com/vi/${lesson.youtubeVideoId}/hqdefault.jpg`
      : null)
  return {
    id: lesson.id,
    course_id: lesson.courseId,
    courseId: lesson.courseId,
    title: lesson.title,
    slug: lesson.slug,
    google_drive_file_id: lesson.googleDriveFileId,
    googleDriveFileId: lesson.googleDriveFileId,
    video_provider: lesson.videoProvider,
    videoProvider: lesson.videoProvider,
    youtube_video_id: lesson.youtubeVideoId,
    youtubeVideoId: lesson.youtubeVideoId,
    thumbnail: thumbnailUrl,
    thumbnailUrl,
    duration: lesson.durationSeconds,
    durationSeconds: lesson.durationSeconds,
    durationFormatted: lesson.durationFormatted,
    lessonNumber: lesson.lessonNumber,
    sortOrder: lesson.sortOrder,
    created_at: lesson.createdAt,
    createdAt: lesson.createdAt,
  }
}

export const lessonService = {
  async create(payload) {
    requireFields(payload, ["title", "course_id"])
    const course = await courseRepository.findById(payload.course_id)
    if (!course) throw new AppError("Course not found", 404)
    const videoProvider = payload.video_provider || payload.videoProvider || "google_drive"
    if (!["google_drive", "youtube"].includes(videoProvider)) {
      throw new AppError("Unsupported video provider", 400)
    }
    if (videoProvider === "google_drive" && !payload.google_drive_file_id) {
      throw new AppError("google_drive_file_id is required", 400)
    }
    if (videoProvider === "youtube" && !(payload.youtube_video_id || payload.youtubeVideoId)) {
      throw new AppError("youtube_video_id is required", 400)
    }
    const metadata = videoProvider === "google_drive"
      ? await googleDriveService.metadata(payload.google_drive_file_id)
      : null
    const parsed = lessonMetadataService.parse(metadata?.name || payload.title)
    const durationSeconds = Number(payload.duration || 0)
    return lessonRepository.create({
      courseId: payload.course_id,
      title: payload.title.trim(),
      slug: payload.slug?.trim() || parsed.slug,
      googleDriveFileId: metadata?.id || null,
      videoProvider,
      youtubeVideoId: videoProvider === "youtube"
        ? (payload.youtube_video_id || payload.youtubeVideoId).trim()
        : null,
      sortOrder: Number(payload.sortOrder ?? parsed.sortOrder),
      lessonNumber: parsed.lessonNumber,
      isIntroduction: parsed.isIntroduction,
      thumbnailUrl: payload.thumbnail?.trim() || null,
      durationSeconds,
      durationFormatted: formatDuration(durationSeconds),
    })
  },

  async update(id, payload) {
    const data = {}
    if (payload.title !== undefined) data.title = payload.title.trim()
    if (payload.course_id !== undefined) data.courseId = payload.course_id
    if (payload.video_provider !== undefined || payload.videoProvider !== undefined) {
      const videoProvider = payload.video_provider || payload.videoProvider
      if (!["google_drive", "youtube"].includes(videoProvider)) {
        throw new AppError("Unsupported video provider", 400)
      }
      data.videoProvider = videoProvider
      if (videoProvider === "youtube") data.googleDriveFileId = null
      if (videoProvider === "google_drive") data.youtubeVideoId = null
    }
    if (payload.youtube_video_id !== undefined || payload.youtubeVideoId !== undefined) {
      const youtubeVideoId = payload.youtube_video_id || payload.youtubeVideoId
      data.youtubeVideoId = youtubeVideoId?.trim() || null
      data.videoProvider = "youtube"
      data.googleDriveFileId = null
    }
    if (payload.google_drive_file_id !== undefined) {
      const metadata = await googleDriveService.metadata(payload.google_drive_file_id)
      const parsed = lessonMetadataService.parse(metadata.name || payload.title || metadata.id)
      data.googleDriveFileId = metadata.id
      data.videoProvider = "google_drive"
      data.youtubeVideoId = null
      data.slug = parsed.slug
      data.sortOrder = parsed.sortOrder
      data.lessonNumber = parsed.lessonNumber
      data.isIntroduction = parsed.isIntroduction
      data.thumbnailUrl = payload.thumbnail?.trim() || null
      data.durationSeconds = Number(payload.duration || 0)
      data.durationFormatted = formatDuration(data.durationSeconds)
    } else {
      if (payload.thumbnail !== undefined) data.thumbnailUrl = payload.thumbnail?.trim() || null
      if (payload.duration !== undefined) {
        data.durationSeconds = Number(payload.duration || 0)
        data.durationFormatted = formatDuration(data.durationSeconds)
      }
      if (payload.sortOrder !== undefined) data.sortOrder = Number(payload.sortOrder)
    }
    return lessonRepository.update(id, data)
  },

  delete(id) {
    return lessonRepository.delete(id)
  },

  async getSubscribedLesson(id, userId) {
    const lesson = await lessonRepository.findById(id)
    if (!lesson) throw new AppError("Lesson not found", 404)
    const progress = await progressRepository.find(userId, id)
    const nextLesson = await lessonRepository.findNext(lesson.courseId, lesson.sortOrder)
    return {
      lesson: {
        ...publicLesson(lesson),
        courseTitle: lesson.course.title,
        nextLessonId: nextLesson?.id || null,
      },
      progress: progress || { currentTime: 0, completed: false },
    }
  },
}
