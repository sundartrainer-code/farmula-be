import { Router } from "express"
import { courseController } from "../controllers/course.controller.js"
import { firebaseAuth } from "../middlewares/firebaseAuth.js"
import { asyncHandler } from "../utils/asyncHandler.js"

export const courseRoutes = Router()

courseRoutes.get("/", firebaseAuth, asyncHandler(courseController.list))
courseRoutes.get("/:id", firebaseAuth, asyncHandler(courseController.get))
