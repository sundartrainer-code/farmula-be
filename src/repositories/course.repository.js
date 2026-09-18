import { prisma } from "../config/prisma.js"

export const courseRepository = {
  findAll() {
    return prisma.course.findMany({
      orderBy: { createdAt: "desc" },
      include: { lessons: { where: { isDeleted: false, published: true }, orderBy: { sortOrder: "asc" } } },
    })
  },
  findById(id) {
    return prisma.course.findUnique({
      where: { id },
      include: { lessons: { where: { isDeleted: false, published: true }, orderBy: { sortOrder: "asc" } } },
    })
  },
  create(data) {
    return prisma.course.create({ data })
  },
  update(id, data) {
    return prisma.course.update({ where: { id }, data })
  },
  delete(id) {
    return prisma.course.delete({ where: { id } })
  },
}
