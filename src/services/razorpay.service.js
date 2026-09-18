import crypto from "crypto"
import Razorpay from "razorpay"
import { env } from "../config/env.js"
import { prisma } from "../config/prisma.js"
import { subscriptionService } from "./subscription.service.js"
import { AppError } from "../utils/AppError.js"

function maskKey(value) {
  if (!value) return "missing"
  return `${value.slice(0, 8)}...${value.slice(-4)}`
}

function keyMode(value) {
  if (value?.startsWith("rzp_live_")) return "live"
  if (value?.startsWith("rzp_test_")) return "test"
  return "unknown"
}

function razorpayErrorMessage(error, fallback) {
  return error?.error?.description
    || error?.error?.reason
    || error?.description
    || error?.message
    || fallback
}

function razorpayErrorDetails(error) {
  return {
    statusCode: error?.statusCode,
    code: error?.error?.code,
    description: error?.error?.description,
    reason: error?.error?.reason,
    source: error?.error?.source,
    step: error?.error?.step,
    metadata: error?.error?.metadata,
    requestId: error?.error?.request_id || error?.headers?.["x-request-id"] || error?.headers?.["x-razorpay-request-id"],
    message: error?.message,
  }
}

function client() {
  if (!env.razorpayKeyId || !env.razorpayKeySecret) {
    throw new AppError("Razorpay is not configured", 500)
  }

  return new Razorpay({
    key_id: env.razorpayKeyId,
    key_secret: env.razorpayKeySecret,
  })
}

function paiseFromRupees(amount) {
  return Math.round(Number(amount) * 100)
}

function verifyWebhookSignature(rawBody, signature) {
  if (!env.razorpayWebhookSecret) throw new AppError("Razorpay webhook is not configured", 500)
  if (!Buffer.isBuffer(rawBody) || !signature) {
    throw new AppError("Invalid webhook request", 400, "RAZORPAY_WEBHOOK_INVALID")
  }

  const expectedSignature = crypto
    .createHmac("sha256", env.razorpayWebhookSecret)
    .update(rawBody)
    .digest("hex")
  const expectedBuffer = Buffer.from(expectedSignature)
  const signatureBuffer = Buffer.from(signature)
  const validSignature = expectedBuffer.length === signatureBuffer.length
    && crypto.timingSafeEqual(expectedBuffer, signatureBuffer)

  if (!validSignature) throw new AppError("Invalid webhook signature", 400, "RAZORPAY_WEBHOOK_SIGNATURE_INVALID")
}

async function firstCapturedPaymentForOrder(orderId) {
  const response = await client().orders.fetchPayments(orderId)
  return response.items?.find((payment) => ["captured", "authorized"].includes(payment.status)) || null
}

export const razorpayService = {
  async createOrder(userId, payload) {
    const planId = payload.plan_id || payload.planId
    const currency = payload.currency || "INR"
    if (!planId) throw new AppError("plan_id is required", 400)

    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } })
    if (!plan || !plan.isActive) throw new AppError("Subscription plan not found", 404)

    const amount = paiseFromRupees(plan.price)
    if (amount < 100) throw new AppError("Minimum amount is 100 paise", 400)

    if (env.debugMedia) {
      console.log("Razorpay order create start", {
        keyId: maskKey(env.razorpayKeyId),
        mode: keyMode(env.razorpayKeyId),
        userId,
        planId: plan.id,
        amount,
        currency,
      })
    }

    try {
      const order = await client().orders.create({
        amount,
        currency,
        receipt: payload.receipt || `sub_${userId.slice(0, 10)}_${Date.now()}`,
        notes: {
          userId,
          planId: plan.id,
        },
      })

      if (env.debugMedia) {
        console.log("Razorpay order create response", order)
      }

      const fetchedOrder = await client().orders.fetch(order.id)
      if (env.debugMedia) {
        console.log("Razorpay order fetch after create response", fetchedOrder)
      }

      return {
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        status: order.status,
        receipt: order.receipt,
        key_id: env.razorpayKeyId,
        fetched_order_status: fetchedOrder.status,
      }
    } catch (error) {
      const message = razorpayErrorMessage(error, "Unable to create payment order")
      console.error("Razorpay create order failed", {
        keyId: maskKey(env.razorpayKeyId),
        mode: keyMode(env.razorpayKeyId),
        userId,
        planId: plan.id,
        amount,
        currency,
        error: razorpayErrorDetails(error),
      })
      if (error.statusCode) throw new AppError(message, error.statusCode, "RAZORPAY_ORDER_FAILED")
      throw new AppError(message, 500, "RAZORPAY_ORDER_FAILED")
    }
  },

  async verifyPayment(userId, payload) {
    const planId = payload.plan_id || payload.planId
    const paymentId = payload.razorpay_payment_id
    const orderId = payload.razorpay_order_id
    const signature = payload.razorpay_signature

    if (!planId || !paymentId || !orderId || !signature) {
      throw new AppError("Missing payment verification fields", 400)
    }

    if (!env.razorpayKeySecret) throw new AppError("Razorpay is not configured", 500)

    if (env.debugMedia) {
      console.log("Razorpay payment verify start", {
        keyId: maskKey(env.razorpayKeyId),
        mode: keyMode(env.razorpayKeyId),
        userId,
        planId,
        orderId,
        paymentId,
        hasSignature: Boolean(signature),
      })
    }

    const expectedSignature = crypto
      .createHmac("sha256", env.razorpayKeySecret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex")

    const expectedBuffer = Buffer.from(expectedSignature)
    const signatureBuffer = Buffer.from(signature)
    const validSignature = expectedBuffer.length === signatureBuffer.length
      && crypto.timingSafeEqual(expectedBuffer, signatureBuffer)

    if (!validSignature) throw new AppError("Payment signature mismatch", 400)

    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } })
    if (!plan || !plan.isActive) throw new AppError("Subscription plan not found", 404)

    try {
      const order = await client().orders.fetch(orderId)
      const expectedAmount = paiseFromRupees(plan.price)
      if (Number(order.amount) !== expectedAmount || order.currency !== "INR") {
        throw new AppError("Payment order does not match selected plan", 400)
      }
      if (order.notes?.userId && order.notes.userId !== userId) {
        throw new AppError("Payment order does not belong to this user", 400)
      }
      if (order.notes?.planId && order.notes.planId !== plan.id) {
        throw new AppError("Payment order does not match selected plan", 400)
      }
      if (env.debugMedia) {
        console.log("Razorpay order verification response", order)
      }
    } catch (error) {
      if (error.statusCode) throw error
      const message = razorpayErrorMessage(error, "Unable to verify payment order")
      console.error("Razorpay order verification failed", {
        keyId: maskKey(env.razorpayKeyId),
        mode: keyMode(env.razorpayKeyId),
        userId,
        planId,
        orderId,
        paymentId,
        error: razorpayErrorDetails(error),
      })
      throw new AppError(message, 500, "RAZORPAY_VERIFY_FAILED")
    }

    const subscription = await subscriptionService.purchase(userId, {
      plan_id: plan.id,
      payment_provider: "razorpay",
      payment_id: paymentId,
    })

    if (env.debugMedia) {
      console.log("Razorpay payment verification success", {
        userId,
        planId: plan.id,
        orderId,
        paymentId,
        subscriptionId: subscription.id,
      })
    }

    return { success: true, subscription }
  },

  async handleWebhook(rawBody, signature) {
    verifyWebhookSignature(rawBody, signature)

    let event
    try {
      event = JSON.parse(rawBody.toString("utf8"))
    } catch {
      throw new AppError("Invalid webhook payload", 400, "RAZORPAY_WEBHOOK_INVALID_JSON")
    }

    const eventName = event.event
    if (!["payment.captured", "order.paid"].includes(eventName)) {
      return { received: true, ignored: true, event: eventName || "unknown" }
    }

    const paymentEntity = event.payload?.payment?.entity || null
    const orderEntity = event.payload?.order?.entity || null
    const orderId = paymentEntity?.order_id || orderEntity?.id
    if (!orderId) throw new AppError("Webhook order_id missing", 400, "RAZORPAY_WEBHOOK_ORDER_MISSING")

    const order = await client().orders.fetch(orderId)
    const payment = paymentEntity?.id
      ? paymentEntity
      : await firstCapturedPaymentForOrder(orderId)

    if (!payment?.id) throw new AppError("Webhook payment_id missing", 400, "RAZORPAY_WEBHOOK_PAYMENT_MISSING")
    if (!["captured", "authorized"].includes(payment.status) && order.status !== "paid") {
      return { received: true, ignored: true, event: eventName, status: payment.status || order.status }
    }

    const userId = order.notes?.userId
    const planId = order.notes?.planId
    if (!userId || !planId) {
      return { received: true, ignored: true, event: eventName, reason: "missing_order_notes" }
    }

    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } })
    if (!plan || !plan.isActive) throw new AppError("Subscription plan not found", 404)

    const expectedAmount = paiseFromRupees(plan.price)
    if (Number(order.amount) !== expectedAmount || order.currency !== "INR") {
      throw new AppError("Webhook order does not match selected plan", 400, "RAZORPAY_WEBHOOK_ORDER_MISMATCH")
    }

    const subscription = await subscriptionService.purchase(userId, {
      plan_id: plan.id,
      payment_provider: "razorpay",
      payment_id: payment.id,
      purchaseDate: payment.created_at ? new Date(payment.created_at * 1000) : new Date(),
    })

    return {
      received: true,
      success: true,
      event: eventName,
      subscriptionId: subscription.id,
    }
  },
}
