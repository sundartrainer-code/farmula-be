import { prisma } from "../config/prisma.js"

export const paymentRepository = {
  create(data) {
    return prisma.payment.create({ data })
  },
  list() {
    return prisma.payment.findMany({
      include: { user: true, subscription: { include: { plan: true } } },
      orderBy: { createdAt: "desc" },
    })
  },
  revenue() {
    return prisma.payment.aggregate({
      where: { status: "paid" },
      _sum: { amount: true },
    })
  },
}
