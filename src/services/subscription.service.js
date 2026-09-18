import { prisma } from "../config/prisma.js"
import { addDays, subscriptionDurationDays } from "../utils/date.js"
import { AppError } from "../utils/AppError.js"
import { subscriptionRepository } from "../repositories/subscription.repository.js"

export const subscriptionService = {
  plans() {
    return subscriptionRepository.plans()
  },

  async status(userId) {
    await subscriptionRepository.expireOld(userId)
    const active = await subscriptionRepository.activeForUser(userId)
    const latest = active || await subscriptionRepository.latestForUser(userId)
    return {
      active: Boolean(active),
      expired: Boolean(!active && latest),
      subscription: latest,
    }
  },

  async purchase(userId, payload) {
    const planId = payload.plan_id || payload.planId
    const paymentProvider = payload.payment_provider || payload.paymentProvider || "manual"
    const paymentId = payload.payment_id || payload.paymentId
    if (!planId || !paymentId) throw new AppError("plan_id and payment_id are required", 400)

    return prisma.$transaction(async (tx) => {
      const plan = await tx.subscriptionPlan.findUnique({ where: { id: planId } })
      if (!plan || !plan.isActive) throw new AppError("Subscription plan not found", 404)

      const existingPayment = await tx.payment.findUnique({
        where: {
          transactionId_paymentProvider: {
            transactionId: paymentId,
            paymentProvider,
          },
        },
        include: { subscription: { include: { plan: true } } },
      })
      if (existingPayment) {
        if (existingPayment.userId !== userId) throw new AppError("Payment reference already used", 409)
        return existingPayment.subscription
      }

      const now = payload.purchaseDate ? new Date(payload.purchaseDate) : new Date()
      const expiryDate = addDays(now, subscriptionDurationDays(plan.durationMonths))

      await tx.subscription.updateMany({
        where: {
          userId,
          status: { in: ["active", "ACTIVE"] },
        },
        data: { status: "REPLACED" },
      })

      const subscription = await tx.subscription.create({
        data: {
          userId,
          planId: plan.id,
          status: "ACTIVE",
          purchaseDate: now,
          startDate: now,
          expiryDate,
          paymentProvider,
          paymentId,
          amountPaid: plan.price,
        },
        include: { plan: true },
      })

      await tx.payment.create({
        data: {
          userId,
          subscriptionId: subscription.id,
          transactionId: paymentId,
          paymentProvider,
          amount: plan.price,
          currency: "INR",
          status: "paid",
        },
      })

      return subscription
    }, {
      isolationLevel: "Serializable",
      maxWait: 20000,
      timeout: 30000,
    })
  },
}
