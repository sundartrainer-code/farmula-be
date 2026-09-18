import { prisma } from "../config/prisma.js"

export const subscriptionRepository = {
  plans() {
    return prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { durationMonths: "asc" },
    })
  },
  planById(id) {
    return prisma.subscriptionPlan.findUnique({ where: { id } })
  },
  activeForUser(userId) {
    return prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: ["active", "ACTIVE"] },
        expiryDate: { gt: new Date() },
      },
      include: { plan: true },
      orderBy: { expiryDate: "desc" },
    })
  },
  latestForUser(userId) {
    return prisma.subscription.findFirst({
      where: { userId },
      include: { plan: true },
      orderBy: { expiryDate: "desc" },
    })
  },
  create(data) {
    return prisma.subscription.create({ data, include: { plan: true } })
  },
  expireOld(userId) {
    return prisma.subscription.updateMany({
      where: { userId, status: { in: ["active", "ACTIVE"] }, expiryDate: { lte: new Date() } },
      data: { status: "EXPIRED" },
    })
  },
}
