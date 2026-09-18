import { app } from "./app.js"
import { env, validateEnv } from "./config/env.js"
import { prisma } from "./config/prisma.js"
import { seedDefaultPlans } from "./services/bootstrap.service.js"
import { googleDriveService } from "./services/google-drive.service.js"

validateEnv()

const server = app.listen(env.port, () => {
  if (env.nodeEnv !== "production") {
    console.log(`Formula LMS API listening on ${env.port}`)
  }

  setImmediate(() => {
    seedDefaultPlans().catch((error) => {
      console.error("Default plan seeding failed", {
        message: error.message,
        code: error.code || null,
      })
    })
  })

  if (env.debugMedia || env.googleDriveDiagnostics) {
    setImmediate(() => {
      googleDriveService.logConfiguredFolderDiagnostics().catch((error) => {
        console.warn("Google Drive diagnostics failed", error.message)
      })
    })
  }
})

async function shutdown() {
  server.close(async () => {
    await prisma.$disconnect()
    process.exit(0)
  })
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
