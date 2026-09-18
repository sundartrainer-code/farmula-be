import { firebaseAdmin } from "../config/firebase.js"
import { userRepository } from "../repositories/user.repository.js"
import { AppError } from "../utils/AppError.js"

export async function firebaseAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || ""
    const token = header.startsWith("Bearer ") ? header.slice(7) : null
    if (!token) throw new AppError("Firebase ID token required", 401)

    const decoded = await firebaseAdmin.auth().verifyIdToken(token)
    const user = await userRepository.upsertFirebaseUser({
      firebaseUid: decoded.uid,
      email: decoded.email,
      displayName: decoded.name || decoded.email,
      photoURL: decoded.picture || null,
    })
    req.user = user
    req.firebase = decoded
    next()
  } catch (error) {
    next(error.statusCode ? error : new AppError("Invalid Firebase ID token", 401))
  }
}

export function requireAdmin(req, _res, next) {
  if (req.user?.role !== "admin") return next(new AppError("Admin access required", 403))
  return next()
}
