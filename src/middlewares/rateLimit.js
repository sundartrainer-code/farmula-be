import { AppError } from "../utils/AppError.js"

function clientKey(req) {
  return req.ip || req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || "unknown"
}

export function rateLimit({ windowMs, max, message = "Too many requests" }) {
  const buckets = new Map()
  let lastSweepAt = 0

  return (req, _res, next) => {
    const now = Date.now()
    if (now - lastSweepAt > windowMs) {
      lastSweepAt = now
      for (const [bucketKey, bucket] of buckets.entries()) {
        if (bucket.resetAt <= now) buckets.delete(bucketKey)
      }
    }

    const key = clientKey(req)
    const current = buckets.get(key)

    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs })
      return next()
    }

    current.count += 1
    if (current.count > max) {
      return next(new AppError(message, 429, "RATE_LIMITED"))
    }

    return next()
  }
}

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  message: "Too many authentication requests",
})

export const paymentRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  message: "Too many payment requests",
})

export const signedVideoRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 120,
  message: "Too many video requests",
})

export const streamRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 240,
  message: "Too many streaming requests",
})

export const adminUploadRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: "Too many upload requests",
})

export const syncRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 60,
  message: "Too many sync requests",
})
