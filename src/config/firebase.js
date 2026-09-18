import admin from "firebase-admin"
import { env } from "./env.js"

function parseServiceAccount() {
  if (env.firebaseServiceAccountBase64) {
    const json = Buffer.from(env.firebaseServiceAccountBase64, "base64").toString("utf8")
    return JSON.parse(json)
  }

  if (env.firebaseServiceAccountJson) {
    return JSON.parse(env.firebaseServiceAccountJson)
  }

  if (!env.firebasePrivateKey?.includes("BEGIN PRIVATE KEY")) {
    throw new Error(
      "FIREBASE_PRIVATE_KEY must be the service account private_key PEM value with escaped newlines, or use FIREBASE_SERVICE_ACCOUNT_BASE64.",
    )
  }

  return {
    projectId: env.firebaseProjectId,
    clientEmail: env.firebaseClientEmail,
    privateKey: env.firebasePrivateKey,
  }
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(parseServiceAccount()),
  })
}

export const firebaseAdmin = admin
