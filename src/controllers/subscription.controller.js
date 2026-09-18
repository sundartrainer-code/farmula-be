import { subscriptionService } from "../services/subscription.service.js"

export const subscriptionController = {
  async plans(_req, res) {
    res.json({ plans: await subscriptionService.plans() })
  },
  async status(req, res) {
    res.json(await subscriptionService.status(req.user.id))
  },
  async purchase(req, res) {
    res.status(201).json({ subscription: await subscriptionService.purchase(req.user.id, req.body) })
  },
}
