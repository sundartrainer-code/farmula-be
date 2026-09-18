import { AppError } from "./AppError.js"

export function requireFields(payload, fields) {
  const missing = fields.filter((field) => payload[field] === undefined || payload[field] === "")
  if (missing.length) throw new AppError(`Missing required fields: ${missing.join(", ")}`, 400)
}
