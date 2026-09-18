import { lessonService } from "../services/lesson.service.js"

export const lessonController = {
  async get(req, res) {
    res.json(await lessonService.getSubscribedLesson(req.params.id, req.user.id))
  },
}
