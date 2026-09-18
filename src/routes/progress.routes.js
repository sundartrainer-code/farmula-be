import { Router } from "express"
import { progressController } from "../controllers/progress.controller.js"
import { firebaseAuth } from "../middlewares/firebaseAuth.js"
import { subscriptionGuard } from "../middlewares/subscriptionGuard.js"
import { asyncHandler } from "../utils/asyncHandler.js"

export const progressRoutes = Router()

progressRoutes.put("/:id", firebaseAuth, subscriptionGuard, asyncHandler(progressController.save))
