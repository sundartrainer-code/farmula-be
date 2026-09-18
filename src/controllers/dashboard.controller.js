import { dashboardService } from "../services/dashboard.service.js"

export const dashboardController = {
  async get(req, res) {
    res.json(await dashboardService.get(req.user.id))
  },
}
