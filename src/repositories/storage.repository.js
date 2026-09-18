import { prisma } from "../config/prisma.js"

export const storageRepository = {
  findByFileId(fileId) {
    return prisma.courseVideo.findUnique({
      where: { googleDriveFileId: fileId },
      include: { course: true },
    })
  },

  findByCourseId(courseId) {
    return prisma.courseVideo.findFirst({
      where: { courseId },
      orderBy: { uploadedAt: "desc" },
    })
  },

  findAll() {
    return prisma.courseVideo.findMany({
      orderBy: { uploadedAt: "desc" },
    })
  },

  create(data) {
    return prisma.courseVideo.create({ data })
  },

  deleteByFileId(fileId) {
    return prisma.courseVideo.delete({
      where: { googleDriveFileId: fileId },
    })
  },
}
