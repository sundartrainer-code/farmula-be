import { courseRepository } from "../repositories/course.repository.js"
import { progressRepository } from "../repositories/progress.repository.js"
import { subscriptionRepository } from "../repositories/subscription.repository.js"
import { AppError } from "../utils/AppError.js"

function remainingDays(expiryDate) {
  return Math.max(0, Math.ceil((new Date(expiryDate).getTime() - Date.now()) / 86400000))
}

function formatDuration(totalSeconds) {
  const minutes = Math.max(1, Math.ceil(Number(totalSeconds || 0) / 60))
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours}h ${rest}m` : `${hours}h`
}

function fallbackThumbnail(course, index = 0) {
  return course.thumbnail || `https://placehold.co/960x540/0f172a/22d3ee?text=${encodeURIComponent(course.title || `Course ${index + 1}`)}`
}

async function decorateCourse(course, userId, index) {
  const lessonIds = course.lessons.map((lesson) => lesson.id)
  const progress = lessonIds.length ? await progressRepository.byCourse(userId, lessonIds) : []
  const progressByLesson = new Map(progress.map((item) => [item.lessonId, item]))
  const completedLessons = progress.filter((item) => item.completed).length
  const totalDurationSeconds = course.lessons.reduce((sum, lesson) => sum + Number(lesson.durationSeconds || 0), 0)
  const lessons = course.lessons.map((lesson, lessonIndex) => {
    const lessonProgress = progressByLesson.get(lesson.id)
    return {
      id: lesson.id,
      courseId: course.id,
      title: lesson.title,
      thumbnail: lesson.thumbnailUrl,
      thumbnailUrl: lesson.thumbnailUrl,
      duration: lesson.durationFormatted,
      durationFormatted: lesson.durationFormatted,
      durationSeconds: lesson.durationSeconds,
      lessonNumber: lesson.lessonNumber,
      sortOrder: lesson.sortOrder,
      completed: Boolean(lessonProgress?.completed),
      currentTime: lessonProgress?.currentTime || 0,
      order: lessonIndex + 1,
    }
  })

  return {
    id: course.id,
    title: course.title,
    description: course.description,
    thumbnail: fallbackThumbnail(course, index),
    instructor: "Formula Faculty",
    lessonCount: course.lessons.length,
    totalDuration: formatDuration(totalDurationSeconds || course.lessons.length * 600),
    progress: {
      totalLessons: course.lessons.length,
      completedLessons,
      completionPercentage: course.lessons.length ? Math.round((completedLessons / course.lessons.length) * 100) : 0,
    },
    lessons,
    resources: [],
  }
}

export const dashboardService = {
  async get(userId) {
    await subscriptionRepository.expireOld(userId)
    const activeSubscription = await subscriptionRepository.activeForUser(userId)
    if (!activeSubscription) throw new AppError("Subscription required", 403, "SUBSCRIPTION_REQUIRED")

    const courses = await courseRepository.findAll()
    const decoratedCourses = await Promise.all(courses.map((course, index) => decorateCourse(course, userId, index)))
    const recentVideos = decoratedCourses
      .flatMap((course) => course.lessons.map((lesson) => ({
        ...lesson,
        courseTitle: course.title,
        instructor: course.instructor,
        courseProgress: course.progress.completionPercentage,
        progress: lesson.completed ? 100 : Math.min(99, Math.round(((lesson.currentTime || 0) / Math.max(lesson.durationSeconds || 1, 1)) * 100)),
      })))
      .filter((lesson) => lesson.currentTime > 0 || lesson.completed)
      .slice(0, 6)
    const totalLessons = decoratedCourses.reduce((sum, course) => sum + course.lessonCount, 0)

    return {
      subscription: {
        active: true,
        plan: activeSubscription.plan.name,
        expiryDate: activeSubscription.expiryDate,
        remainingDays: remainingDays(activeSubscription.expiryDate),
      },
      stats: {
        totalCourses: decoratedCourses.length,
        totalLessons,
      },
      courses: decoratedCourses,
      recentLessons: recentVideos,
      recentVideos,
      resources: [],
    }
  },
}
