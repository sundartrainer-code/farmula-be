import { prisma } from "../config/prisma.js"

export const progressRepository = {
  find(userId, lessonId) {
    return prisma.progress.findUnique({
      where: { userId_lessonId: { userId, lessonId } },
    })
  },
  upsert(userId, lessonId, data) {
    return prisma.progress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      update: data,
      create: { userId, lessonId, ...data },
    })
  },
  byCourse(userId, lessonIds) {
    return prisma.progress.findMany({
      where: { userId, lessonId: { in: lessonIds } },
    })
  },
}
