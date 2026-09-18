import { prisma } from "../config/prisma.js"

export const adminService = {
  async stats() {
    const now = new Date()
    const [
      users,
      payments,
      activeSubscriptions,
      expiredSubscriptions,
      revenue,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.payment.findMany({ orderBy: { createdAt: "desc" }, include: { user: true } }),
      prisma.subscription.count({ where: { status: { in: ["active", "ACTIVE"] }, expiryDate: { gt: now } } }),
      prisma.subscription.count({ where: { OR: [{ status: { in: ["expired", "EXPIRED", "REPLACED"] } }, { expiryDate: { lte: now } }] } }),
      prisma.payment.aggregate({ where: { status: "paid" }, _sum: { amount: true } }),
    ])
    return {
      totalUsers: users,
      revenue: revenue._sum.amount || 0,
      activeSubscriptions,
      expiredSubscriptions,
      payments,
    }
  },

  users() {
    return prisma.user.findMany({ orderBy: { createdAt: "desc" } })
  },

  payments() {
    return prisma.payment.findMany({
      orderBy: { createdAt: "desc" },
      include: { user: true, subscription: { include: { plan: true } } },
    })
  },

  createPlan(data) {
    return prisma.subscriptionPlan.create({
      data: {
        name: data.name,
        durationMonths: Number(data.durationMonths ?? data.duration_months),
        price: Number(data.price),
        isActive: data.isActive ?? data.is_active ?? true,
      },
    })
  },

  updatePlan(id, data) {
    return prisma.subscriptionPlan.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.durationMonths !== undefined || data.duration_months !== undefined
          ? { durationMonths: Number(data.durationMonths ?? data.duration_months) }
          : {}),
        ...(data.price !== undefined ? { price: Number(data.price) } : {}),
        ...(data.isActive !== undefined || data.is_active !== undefined
          ? { isActive: data.isActive ?? data.is_active }
          : {}),
      },
    })
  },

  deletePlan(id) {
    return prisma.subscriptionPlan.update({ where: { id }, data: { isActive: false } })
  },
}
