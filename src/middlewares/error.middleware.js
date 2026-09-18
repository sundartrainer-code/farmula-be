export function notFound(_req, res) {
  res.status(404).json({ message: "Route not found" })
}

export function errorHandler(error, _req, res, _next) {
  if (error.name === "MulterError") {
    const message = error.code === "LIMIT_FILE_SIZE"
      ? "Video file exceeds 5GB limit"
      : error.message
    return res.status(400).json({ message, code: error.code })
  }

  const statusCode = error.statusCode || 500
  if (statusCode >= 500) {
    console.error(error)
  }

  res.status(statusCode).json({
    message: statusCode === 500 ? "Unexpected server error" : error.message,
    ...(error.code ? { code: error.code } : {}),
  })
}
