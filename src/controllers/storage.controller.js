import { storageService } from "../services/storage.service.js"

export const storageController = {
  async upload(req, res) {
    const video = await storageService.upload({
      courseId: req.body.courseId,
      file: req.file,
    })

    res.status(201).json({
      success: true,
      fileId: video.googleDriveFileId,
      filename: video.filename,
      mimeType: video.mimeType,
      size: video.size,
      publicUrl: video.publicUrl,
    })
  },

  async stream(req, res) {
    await storageService.stream({
      fileId: req.params.fileId,
      range: req.headers.range,
      token: req.query.token,
      expires: req.query.expires,
      method: req.method,
    }, res)
  },

  async testStream(req, res) {
    await storageService.testStream({
      fileId: req.params.fileId,
      range: req.headers.range,
    }, res)
  },

  async byCourse(req, res) {
    res.json({ video: await storageService.byCourse(req.params.courseId) })
  },

  async streamLink(req, res) {
    res.json(await storageService.streamLink({
      fileId: req.params.fileId,
      req,
    }))
  },

  async delete(req, res) {
    res.json(await storageService.delete(req.params.fileId))
  },

  async replace(req, res) {
    const video = await storageService.replace({
      courseId: req.params.courseId,
      file: req.file,
    })

    res.json({
      success: true,
      fileId: video.googleDriveFileId,
      filename: video.filename,
      mimeType: video.mimeType,
      size: video.size,
      publicUrl: video.publicUrl,
    })
  },
}
