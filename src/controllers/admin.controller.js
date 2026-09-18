import { courseService } from "../services/course.service.js"
import { lessonService } from "../services/lesson.service.js"
import { adminService } from "../services/admin.service.js"
import { lessonOrderService } from "../services/lesson-order.service.js"

export const adminController = {
  async stats(_req, res) {
    res.json(await adminService.stats())
  },

  async users(_req, res) {
    res.json({ users: await adminService.users() })
  },

  async payments(_req, res) {
    res.json({ payments: await adminService.payments() })
  },

  async lessons(_req, res) {
    res.json({ lessons: await lessonOrderService.list() })
  },

  async reorderLessons(req, res) {
    res.json({ lessons: await lessonOrderService.reorder(req.body.lessons) })
  },

  async createPlan(req, res) {
    res.status(201).json({ plan: await adminService.createPlan(req.body) })
  },

  async updatePlan(req, res) {
    res.json({ plan: await adminService.updatePlan(req.params.id, req.body) })
  },

  async deletePlan(req, res) {
    res.json({ plan: await adminService.deletePlan(req.params.id) })
  },

  async createCourse(req, res) {
    res.status(201).json({ course: await courseService.create(req.body) })
  },

  async updateCourse(req, res) {
    res.json({ course: await courseService.update(req.params.id, req.body) })
  },

  async deleteCourse(req, res) {
    await courseService.delete(req.params.id)
    res.json({ message: "Course deleted" })
  },

  async createLesson(req, res) {
    res.status(201).json({ lesson: await lessonService.create(req.body) })
  },

  async updateLesson(req, res) {
    res.json({ lesson: await lessonService.update(req.params.id, req.body) })
  },

  async deleteLesson(req, res) {
    await lessonService.delete(req.params.id)
    res.json({ message: "Lesson deleted" })
  },
}
