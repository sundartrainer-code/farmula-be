import { Router } from "express"
import { storageController } from "../controllers/storage.controller.js"
import { firebaseAuth, requireAdmin } from "../middlewares/firebaseAuth.js"
import { adminUploadRateLimit, streamRateLimit } from "../middlewares/rateLimit.js"
import { subscriptionGuard } from "../middlewares/subscriptionGuard.js"
import { videoUpload } from "../middlewares/upload.middleware.js"
import { asyncHandler } from "../utils/asyncHandler.js"

export const storageRoutes = Router()

storageRoutes.post(
  "/upload",
  adminUploadRateLimit,
  firebaseAuth,
  requireAdmin,
  videoUpload.single("file"),
  asyncHandler(storageController.upload),
)

storageRoutes.get(
  "/course/:courseId",
  firebaseAuth,
  subscriptionGuard,
  asyncHandler(storageController.byCourse),
)

storageRoutes.get(
  "/video-link/:fileId",
  firebaseAuth,
  subscriptionGuard,
  asyncHandler(storageController.streamLink),
)

storageRoutes.get(
  "/video/:fileId",
  streamRateLimit,
  asyncHandler(storageController.stream),
)

storageRoutes.get(
  "/video-test/:fileId",
  streamRateLimit,
  firebaseAuth,
  requireAdmin,
  asyncHandler(storageController.testStream),
)

storageRoutes.delete(
  "/:fileId",
  firebaseAuth,
  requireAdmin,
  asyncHandler(storageController.delete),
)

storageRoutes.put(
  "/:courseId",
  adminUploadRateLimit,
  firebaseAuth,
  requireAdmin,
  videoUpload.single("file"),
  asyncHandler(storageController.replace),
)
