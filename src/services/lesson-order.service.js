import { prisma } from "../config/prisma.js"
import { AppError } from "../utils/AppError.js"

export const lessonOrderService = {
  list() {
    return prisma.lesson.findMany({
      where: { isDeleted: false },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        title: true,
        lessonNumber: true,
        sortOrder: true,
        thumbnailUrl: true,
        durationFormatted: true,
        googleDriveFileId: true,
        videoProvider: true,
        youtubeVideoId: true,
      },
    })
  },

  async reorder(items) {
    if (!Array.isArray(items) || !items.length) {
      throw new AppError("lessons must be a non-empty array", 400)
    }

    const normalized = items.map((item, index) => {
      if (!item?.id || typeof item.id !== "string") {
        throw new AppError(`Invalid lesson id at position ${index}`, 400)
      }
      const sortOrder = Number(item.sortOrder)
      if (!Number.isInteger(sortOrder) || sortOrder < 0) {
        throw new AppError(`Invalid sortOrder at position ${index}`, 400)
      }
      return { id: item.id, sortOrder }
    })

    if (new Set(normalized.map((item) => item.id)).size !== normalized.length) {
      throw new AppError("Duplicate lesson ids are not allowed", 400)
    }

    await prisma.$transaction(
      normalized.map((item) =>
        prisma.lesson.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder },
        }),
      ),
    )

    return this.list()
  },
}
