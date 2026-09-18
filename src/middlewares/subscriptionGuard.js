import { subscriptionRepository } from "../repositories/subscription.repository.js"
import { AppError } from "../utils/AppError.js"

export async function subscriptionGuard(req, _res, next) {
  try {
    await subscriptionRepository.expireOld(req.user.id)
    const subscription = await subscriptionRepository.activeForUser(req.user.id)
    if (!subscription) throw new AppError("Subscription required", 403, "SUBSCRIPTION_REQUIRED")
    req.subscription = subscription
    next()
  } catch (error) {
    next(error)
  }
}
