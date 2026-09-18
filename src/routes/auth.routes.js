import { Router } from "express"
import { authController } from "../controllers/auth.controller.js"
import { firebaseAuth } from "../middlewares/firebaseAuth.js"

export const authRoutes = Router()

authRoutes.get("/me", firebaseAuth, authController.me)
authRoutes.post("/logout", firebaseAuth, authController.logout)
