import { courseRepository } from "../repositories/course.repository.js"
import { progressRepository } from "../repositories/progress.repository.js"
import { subscriptionRepository } from "../repositories/subscription.repository.js"
import { AppError } from "../utils/AppError.js"
import { requireFields } from "../utils/validators.js"

async function decorateCourse(course, userId) {
  const activeSubscription = userId ? Boolean(await subscriptionRepository.activeForUser(userId)) : false
  const lessonIds = course.lessons.map((lesson) => lesson.id)
  const progress = userId ? await progressRepository.byCourse(userId, lessonIds) : []
  const progressByLesson = new Map(progress.map((item) => [item.lessonId, item]))
  const completed = progress.filter((item) => item.completed).length
  return {
    ...course,
    lessons: course.lessons.map((lesson) => ({
      ...lesson,
      currentTime: progressByLesson.get(lesson.id)?.currentTime || 0,
      completed: progressByLesson.get(lesson.id)?.completed || false,
    })),
    hasActiveSubscription: activeSubscription,
    purchased: activeSubscription,
    progress: {
      totalLessons: course.lessons.length,
      completedLessons: completed,
      completionPercentage: course.lessons.length ? Math.round((completed / course.lessons.length) * 100) : 0,
    },
  }
}

export const courseService = {
  async list(userId) {
    const courses = await courseRepository.findAll()
    return Promise.all(courses.map((course) => decorateCourse(course, userId)))
  },

  async get(id, userId) {
    const course = await courseRepository.findById(id)
    if (!course) throw new AppError("Course not found", 404)
    const decorated = await decorateCourse(course, userId)
    return decorated.purchased
      ? decorated
      : { ...decorated, lessons: [] }
  },

  create(payload) {
    requireFields(payload, ["title", "description"])
    return courseRepository.create({
      title: payload.title.trim(),
      description: payload.description.trim(),
      thumbnail: payload.thumbnail?.trim() || null,
    })
  },

  update(id, payload) {
    return courseRepository.update(id, {
      ...(payload.title !== undefined ? { title: payload.title.trim() } : {}),
      ...(payload.description !== undefined ? { description: payload.description.trim() } : {}),
      ...(payload.thumbnail !== undefined ? { thumbnail: payload.thumbnail?.trim() || null } : {}),
    })
  },

  delete(id) {
    return courseRepository.delete(id)
  },
}
