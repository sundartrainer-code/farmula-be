import express, { Router } from "express"
import { paymentController } from "../controllers/payment.controller.js"
import { asyncHandler } from "../utils/asyncHandler.js"

export const razorpayWebhookRoutes = Router()

razorpayWebhookRoutes.post(
  "/razorpay/webhook",
  express.raw({ type: "application/json", limit: "1mb" }),
  asyncHandler(paymentController.webhook),
)
