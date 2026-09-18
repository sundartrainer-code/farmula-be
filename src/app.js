import cors from "cors"
import express from "express"
import helmet from "helmet"
import morgan from "morgan"
import { corsOptions } from "./config/cors.js"
import { prisma } from "./config/prisma.js"
import { errorHandler, notFound } from "./middlewares/error.middleware.js"
import { authRateLimit, paymentRateLimit, signedVideoRateLimit } from "./middlewares/rateLimit.js"
import { adminRoutes } from "./routes/admin.routes.js"
import { authRoutes } from "./routes/auth.routes.js"
import { courseRoutes } from "./routes/course.routes.js"
import { dashboardRoutes } from "./routes/dashboard.routes.js"
import { lessonRoutes } from "./routes/lesson.routes.js"
import { libraryRoutes } from "./routes/library.routes.js"
import { paymentRoutes } from "./routes/payment.routes.js"
import { razorpayWebhookRoutes } from "./routes/razorpayWebhook.routes.js"
import { progressRoutes } from "./routes/progress.routes.js"
import { storageRoutes } from "./routes/storage.routes.js"
import { subscriptionRoutes } from "./routes/subscription.routes.js"
import { videoRoutes } from "./routes/video.routes.js"

export const app = express()

app.disable("x-powered-by")
app.set("trust proxy", 1)

app.use(cors(corsOptions))
app.options("*", cors(corsOptions))

app.use(helmet({
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'none'"],
      formAction: ["'none'"],
    },
  },
  referrerPolicy: { policy: "no-referrer" },
  frameguard: { action: "deny" },
  noSniff: true,
}))
app.use((_req, res, next) => {
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), fullscreen=(self)",
  )
  next()
})
app.use(morgan("combined"))
app.use("/api", paymentRateLimit, razorpayWebhookRoutes)
app.use(express.json({ limit: "1mb" }))

app.get("/version", (_req, res) => {
  res.json({ version: "2026-07-03-cors-fix" })
})

app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({
      status: "ok",
      service: "formula-lms-api",
      runtime: "node",
      database: "connected",
    })
  } catch {
    res.status(503).json({
      status: "error",
      service: "formula-lms-api",
      runtime: "node",
      database: "disconnected",
    })
  }
})

app.use("/auth", authRateLimit, authRoutes)
app.use("/api/dashboard", dashboardRoutes)
app.use("/api", libraryRoutes)
app.use("/api", paymentRateLimit, paymentRoutes)
app.use("/courses", courseRoutes)
app.use("/lesson", lessonRoutes)
app.use("/api/video", signedVideoRateLimit, videoRoutes)
app.use("/api/storage", storageRoutes)
app.use("/progress", progressRoutes)
app.use("/subscription", subscriptionRoutes)
app.use("/admin", adminRoutes)
app.use("/api/admin", adminRoutes)

app.use(notFound)
app.use(errorHandler)
