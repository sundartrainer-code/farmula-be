import { razorpayService } from "../services/razorpay.service.js"

export const paymentController = {
  async createOrder(req, res) {
    res.status(201).json(await razorpayService.createOrder(req.user.id, req.body))
  },

  async verifyPayment(req, res) {
    res.json(await razorpayService.verifyPayment(req.user.id, req.body))
  },

  async webhook(req, res) {
    res.json(await razorpayService.handleWebhook(req.body, req.get("X-Razorpay-Signature")))
  },
}
