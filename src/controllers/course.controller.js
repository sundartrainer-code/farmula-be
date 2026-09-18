import { courseService } from "../services/course.service.js"

export const courseController = {
  async list(req, res) {
    res.json({ courses: await courseService.list(req.user.id) })
  },

  async get(req, res) {
    res.json({ course: await courseService.get(req.params.id, req.user.id) })
  },
}
