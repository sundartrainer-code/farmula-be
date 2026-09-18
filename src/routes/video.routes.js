import { Router } from "express"
import { videoController } from "../controllers/video.controller.js"
import { firebaseAuth } from "../middlewares/firebaseAuth.js"
import { subscriptionGuard } from "../middlewares/subscriptionGuard.js"
import { asyncHandler } from "../utils/asyncHandler.js"

export const videoRoutes = Router()

videoRoutes.get("/refresh", firebaseAuth, subscriptionGuard, asyncHandler(videoController.refresh))
videoRoutes.get("/:lessonId", firebaseAuth, subscriptionGuard, asyncHandler(videoController.signedUrl))
