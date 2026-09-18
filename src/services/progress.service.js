import { lessonRepository } from "../repositories/lesson.repository.js"
import { progressRepository } from "../repositories/progress.repository.js"
import { AppError } from "../utils/AppError.js"

export const progressService = {
  async save(userId, lessonId, payload) {
    const lesson = await lessonRepository.findById(lessonId)
    if (!lesson) throw new AppError("Lesson not found", 404)
    return progressRepository.upsert(userId, lessonId, {
      currentTime: Math.max(0, Number(payload.current_time ?? payload.currentTime ?? 0)),
      completed: Boolean(payload.completed),
    })
  },
}
