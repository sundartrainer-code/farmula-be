import "dotenv/config"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const DEV_USER = {
  firebaseUid: "kqTNWdV8EqXI8lT1EJoHDigZuhM2",
  email: "tatikondamadhav@gmail.com",
  displayName: "Madhav Tatikonda",
  role: "student",
}

const DEV_PLAN = {
  name: "3 Months",
  durationMonths: 3,
  price: 2699,
  isActive: true,
}

const DEV_SUBSCRIPTION = {
  status: "ACTIVE",
  paymentProvider: "DEVELOPMENT",
  paymentId: "DEV-SUBSCRIPTION",
  amountPaid: 2699,
}

const DEV_PAYMENT = {
  paymentProvider: "DEVELOPMENT",
  transactionId: "DEV-TEST-PAYMENT",
  amount: 2699,
  currency: "INR",
  status: "SUCCESS",
}

function addMonths(date, months) {
  const result = new Date(date)
  const day = result.getDate()
  result.setMonth(result.getMonth() + months)

  if (result.getDate() !== day) {
    result.setDate(0)
  }

  return result
}

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PRODUCTION_DEV_GRANT !== "true") {
    throw new Error("Refusing to run development subscription grant in production.")
  }

  const result = await prisma.$transaction(async (tx) => {
    const existingUserByFirebaseUid = await tx.user.findUnique({
      where: { firebaseUid: DEV_USER.firebaseUid },
    })
    const existingUser = existingUserByFirebaseUid || await tx.user.findUnique({
      where: { email: DEV_USER.email },
    })

    const user = existingUser
      ? await tx.user.update({
          where: { id: existingUser.id },
          data: {
            firebaseUid: DEV_USER.firebaseUid,
            email: DEV_USER.email,
            displayName: existingUser.displayName || DEV_USER.displayName,
            role: existingUser.role || DEV_USER.role,
          },
        })
      : await tx.user.create({ data: DEV_USER })

    const existingPlan = await tx.subscriptionPlan.findFirst({
      where: { name: DEV_PLAN.name },
    })

    const plan = existingPlan
      ? await tx.subscriptionPlan.update({
          where: { id: existingPlan.id },
          data: DEV_PLAN,
        })
      : await tx.subscriptionPlan.create({ data: DEV_PLAN })

    const now = new Date()
    const expiryDate = addMonths(now, DEV_PLAN.durationMonths)

    const reusableDevSubscription = await tx.subscription.findFirst({
      where: {
        userId: user.id,
        paymentProvider: DEV_SUBSCRIPTION.paymentProvider,
        paymentId: DEV_SUBSCRIPTION.paymentId,
      },
    })

    await tx.subscription.updateMany({
      where: {
        userId: user.id,
        status: { in: ["ACTIVE", "active"] },
        ...(reusableDevSubscription ? { id: { not: reusableDevSubscription.id } } : {}),
      },
      data: {
        status: "EXPIRED",
        expiryDate: now,
      },
    })

    const subscriptionData = {
      userId: user.id,
      planId: plan.id,
      status: DEV_SUBSCRIPTION.status,
      purchaseDate: now,
      startDate: now,
      expiryDate,
      paymentProvider: DEV_SUBSCRIPTION.paymentProvider,
      paymentId: DEV_SUBSCRIPTION.paymentId,
      amountPaid: DEV_SUBSCRIPTION.amountPaid,
    }

    const subscription = reusableDevSubscription
      ? await tx.subscription.update({
          where: { id: reusableDevSubscription.id },
          data: subscriptionData,
          include: { plan: true },
        })
      : await tx.subscription.create({
          data: subscriptionData,
          include: { plan: true },
        })

    await tx.payment.upsert({
      where: {
        transactionId_paymentProvider: {
          transactionId: DEV_PAYMENT.transactionId,
          paymentProvider: DEV_PAYMENT.paymentProvider,
        },
      },
      update: {
        userId: user.id,
        subscriptionId: subscription.id,
        amount: DEV_PAYMENT.amount,
        currency: DEV_PAYMENT.currency,
        status: DEV_PAYMENT.status,
      },
      create: {
        userId: user.id,
        subscriptionId: subscription.id,
        ...DEV_PAYMENT,
      },
    })

    return { user, subscription }
  }, {
    maxWait: 20000,
    timeout: 30000,
  })

  console.log(`✓ User ID: ${result.user.id}`)
  console.log(`✓ Subscription ID: ${result.subscription.id}`)
  console.log(`✓ Plan: ${result.subscription.plan.name}`)
  console.log(`✓ Expiry Date: ${result.subscription.expiryDate.toISOString()}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
