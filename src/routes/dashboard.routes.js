import { Router } from "express"
import { dashboardController } from "../controllers/dashboard.controller.js"
import { firebaseAuth } from "../middlewares/firebaseAuth.js"
import { asyncHandler } from "../utils/asyncHandler.js"

export const dashboardRoutes = Router()

dashboardRoutes.get("/", firebaseAuth, asyncHandler(dashboardController.get))
