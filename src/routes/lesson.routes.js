import { Router } from "express"
import { lessonController } from "../controllers/lesson.controller.js"
import { firebaseAuth } from "../middlewares/firebaseAuth.js"
import { subscriptionGuard } from "../middlewares/subscriptionGuard.js"
import { asyncHandler } from "../utils/asyncHandler.js"

export const lessonRoutes = Router()

lessonRoutes.get("/:id", firebaseAuth, subscriptionGuard, asyncHandler(lessonController.get))
