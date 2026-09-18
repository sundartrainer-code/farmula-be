import dotenv from "dotenv"

dotenv.config()

function normalizePrivateKey(value) {
  if (!value) return value
  const trimmed = value.trim()
  const unquoted = trimmed
    .replace(/^"|"$/g, "")
    .replace(/^'|'$/g, "")
    .replace(/\\n/g, "\n")

  if (unquoted.includes("BEGIN PRIVATE KEY")) return unquoted

  try {
    const decoded = Buffer.from(unquoted, "base64").toString("utf8")
    if (decoded.includes("BEGIN PRIVATE KEY")) return decoded
  } catch {
    return unquoted
  }

  return unquoted
}

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 8081),
  debugMedia: process.env.DEBUG_MEDIA === "true",
  googleDriveDiagnostics: process.env.GOOGLE_DRIVE_DIAGNOSTICS === "true",
  databaseUrl: process.env.DATABASE_URL,
  frontendOrigin: process.env.FRONTEND_ORIGIN || "",
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
  firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  firebasePrivateKey: normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
  firebaseServiceAccountBase64: process.env.FIREBASE_SERVICE_ACCOUNT_BASE64,
  firebaseServiceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
  razorpayKeyId: process.env.RAZORPAY_KEY_ID,
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET,
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
  googleProjectId: process.env.GOOGLE_PROJECT_ID,
  googleClientEmail: process.env.GOOGLE_CLIENT_EMAIL,
  googlePrivateKey: normalizePrivateKey(process.env.GOOGLE_PRIVATE_KEY),
  googleDriveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID,
  googleServiceAccountJson: process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
  googleDriveSyncIntervalSeconds: Number(process.env.GOOGLE_DRIVE_SYNC_INTERVAL_SECONDS || 300),
}

export function validateEnv() {
  const required = [
    "databaseUrl",
    "razorpayKeyId",
    "razorpayKeySecret",
  ]
  if (!env.googleServiceAccountJson) {
    required.push("googleClientEmail", "googlePrivateKey")
  }
  if (!env.firebaseServiceAccountBase64 && !env.firebaseServiceAccountJson) {
    required.push("firebaseProjectId", "firebaseClientEmail", "firebasePrivateKey")
  }
  const missing = required.filter((key) => !env[key])
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`)
  }
}

export const secureCookies = env.nodeEnv === "production"
