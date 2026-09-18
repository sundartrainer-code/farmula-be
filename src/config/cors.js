import { env } from "./env.js"

const requiredOrigins = [
  "http://localhost:5173",
  "https://clinquant-brigadeiros-291a78.netlify.app",
  "https://formulaiq.co.in",
  "https://www.formulaiq.co.in",
]

const configuredOrigins = env.frontendOrigin
  .split(",")
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean)

export const allowedOrigins = new Set([
  ...requiredOrigins,
  ...configuredOrigins,
])

export const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin.replace(/\/+$/, ""))) {
      return callback(null, true)
    }

    const error = new Error("CORS Not Allowed")
    error.statusCode = 403
    return callback(error)
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Authorization", "Content-Type"],
  optionsSuccessStatus: 200,
}
