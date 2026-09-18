import { videoService } from "../services/video.service.js"

export const videoController = {
  async signedUrl(req, res) {
    res.set("Cache-Control", "no-store")
    res.json(await videoService.signedUrl(req.params.lessonId, req))
  },

  async refresh(req, res) {
    res.set("Cache-Control", "no-store")
    res.json(await videoService.signedUrl(req.query.lessonId, req))
  },
}
