import { progressService } from "../services/progress.service.js"

export const progressController = {
  async save(req, res) {
    res.json({ progress: await progressService.save(req.user.id, req.params.id, req.body) })
  },
}
