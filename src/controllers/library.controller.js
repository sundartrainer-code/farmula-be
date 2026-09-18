import { videoLibraryService } from "../services/video-library.service.js"

export const libraryController = {
  async videos(req, res) {
    res.set("Cache-Control", "private, no-store")
    const videos = await videoLibraryService.list(req.user.id)
    res.json(videos)
  },
}
