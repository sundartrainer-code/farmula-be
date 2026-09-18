import { Router } from "express"
import { paymentController } from "../controllers/payment.controller.js"
import { firebaseAuth } from "../middlewares/firebaseAuth.js"
import { asyncHandler } from "../utils/asyncHandler.js"

export const paymentRoutes = Router()

paymentRoutes.post("/create-order", firebaseAuth, asyncHandler(paymentController.createOrder))
paymentRoutes.post("/verify-payment", firebaseAuth, asyncHandler(paymentController.verifyPayment))
