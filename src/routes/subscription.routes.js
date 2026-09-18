import { Router } from "express"
import { subscriptionController } from "../controllers/subscription.controller.js"
import { firebaseAuth } from "../middlewares/firebaseAuth.js"
import { asyncHandler } from "../utils/asyncHandler.js"

export const subscriptionRoutes = Router()

subscriptionRoutes.get("/plans", firebaseAuth, asyncHandler(subscriptionController.plans))
subscriptionRoutes.get("/status", firebaseAuth, asyncHandler(subscriptionController.status))
subscriptionRoutes.post("/purchase", firebaseAuth, asyncHandler(subscriptionController.purchase))
