import { Router } from "express"
import { libraryController } from "../controllers/library.controller.js"
import { firebaseAuth } from "../middlewares/firebaseAuth.js"
import { syncRateLimit } from "../middlewares/rateLimit.js"
import { subscriptionGuard } from "../middlewares/subscriptionGuard.js"
import { asyncHandler } from "../utils/asyncHandler.js"

export const libraryRoutes = Router()

libraryRoutes.get("/videos", syncRateLimit, firebaseAuth, subscriptionGuard, asyncHandler(libraryController.videos))
