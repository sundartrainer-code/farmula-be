import { prisma } from "../config/prisma.js"

export const lessonRepository = {
  findById(id) {
    return prisma.lesson.findFirst({ where: { id, isDeleted: false, published: true }, include: { course: true } })
  },
  findAllActive(userId) {
    return prisma.lesson.findMany({
      where: { isDeleted: false, published: true },
      orderBy: { sortOrder: "asc" },
      include: {
        course: { select: { title: true } },
        progress: {
          where: { userId },
          take: 1,
          select: { currentTime: true, completed: true, updatedAt: true },
        },
      },
    })
  },
  findAllSyncedActive(userId) {
    return prisma.lesson.findMany({
      where: {
        isDeleted: false,
        published: true,
        OR: [
          { googleDriveFileId: { not: null } },
          { videoProvider: "youtube", youtubeVideoId: { not: null } },
        ],
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: {
        course: { select: { title: true } },
        progress: {
          where: { userId },
          take: 1,
          select: { currentTime: true, completed: true, updatedAt: true },
        },
      },
    })
  },
  countActiveYoutube() {
    return prisma.lesson.count({
      where: {
        videoProvider: "youtube",
        youtubeVideoId: { not: null },
        isDeleted: false,
        published: true,
      },
    })
  },
  create(data) {
    return prisma.lesson.create({ data })
  },
  update(id, data) {
    return prisma.lesson.update({ where: { id }, data })
  },
  delete(id) {
    return prisma.lesson.delete({ where: { id } })
  },
  findNext(courseId, sortOrder) {
    return prisma.lesson.findFirst({
      where: { courseId, isDeleted: false, published: true, sortOrder: { gt: sortOrder } },
      orderBy: { sortOrder: "asc" },
      select: { id: true },
    })
  },
}
