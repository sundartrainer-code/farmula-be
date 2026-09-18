import { lessonRepository } from "../repositories/lesson.repository.js"
import { AppError } from "../utils/AppError.js"
import { storageService } from "./storage.service.js"

export const videoService = {
  async signedUrl(lessonId, req) {
    if (!lessonId) throw new AppError("lessonId is required", 400)
    const lesson = await lessonRepository.findById(lessonId)
    const fileId = lesson?.googleDriveFileId || lessonId

    if (lesson?.videoProvider === "youtube") {
      if (!lesson.youtubeVideoId) throw new AppError("YouTube video is not configured for this lesson", 404)
      return {
        type: "youtube",
        youtubeVideoId: lesson.youtubeVideoId,
        expiresAt: null,
      }
    }

    if (lesson && !lesson.googleDriveFileId) {
      throw new AppError("Google Drive video is not configured for this lesson", 404)
    }

    return {
      ...await storageService.streamLink({ fileId, req }),
      type: "mp4",
      hls: false,
    }
  },
}
