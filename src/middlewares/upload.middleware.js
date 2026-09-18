import os from "node:os"
import crypto from "node:crypto"
import multer from "multer"

const FIVE_GB = 5 * 1024 * 1024 * 1024

export const videoUpload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (_req, file, callback) => {
      const safeName = file.originalname.replace(/[^\w.\-]+/g, "_")
      callback(null, `${Date.now()}-${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}-${safeName}`)
    },
  }),
  limits: {
    fileSize: FIVE_GB,
    files: 1,
  },
})
