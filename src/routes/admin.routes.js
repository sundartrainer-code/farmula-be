import { Router } from "express"
import { adminController } from "../controllers/admin.controller.js"
import { firebaseAuth, requireAdmin } from "../middlewares/firebaseAuth.js"
import { asyncHandler } from "../utils/asyncHandler.js"

export const adminRoutes = Router()

adminRoutes.use(firebaseAuth, requireAdmin)
adminRoutes.get("/stats", asyncHandler(adminController.stats))
adminRoutes.get("/users", asyncHandler(adminController.users))
adminRoutes.get("/payments", asyncHandler(adminController.payments))
adminRoutes.get("/lessons", asyncHandler(adminController.lessons))
adminRoutes.patch("/lessons/order", asyncHandler(adminController.reorderLessons))
adminRoutes.post("/plan", asyncHandler(adminController.createPlan))
adminRoutes.put("/plan/:id", asyncHandler(adminController.updatePlan))
adminRoutes.delete("/plan/:id", asyncHandler(adminController.deletePlan))
adminRoutes.post("/course", asyncHandler(adminController.createCourse))
adminRoutes.put("/course/:id", asyncHandler(adminController.updateCourse))
adminRoutes.delete("/course/:id", asyncHandler(adminController.deleteCourse))
adminRoutes.post("/lesson", asyncHandler(adminController.createLesson))
adminRoutes.put("/lesson/:id", asyncHandler(adminController.updateLesson))
adminRoutes.delete("/lesson/:id", asyncHandler(adminController.deleteLesson))
