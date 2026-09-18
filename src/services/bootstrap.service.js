import { prisma } from "../config/prisma.js"

const DEFAULT_PLANS = [
  { name: "1 Month", durationMonths: 1, price: 999, isActive: true },
  { name: "2 Months", durationMonths: 2, price: 1999, isActive: true },
  { name: "3 Months", durationMonths: 3, price: 2699, isActive: true },
]

const SEED_RETRY_ATTEMPTS = 5
const SEED_RETRY_DELAY_MS = 2000

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function isDatabaseReachabilityError(error) {
  return error.name === "PrismaClientInitializationError"
    || error.code === "P1001"
    || error.message?.includes("Can't reach database server")
}

async function seedPlansOnce() {
  for (const plan of DEFAULT_PLANS) {
    const existing = await prisma.subscriptionPlan.findFirst({
      where: { durationMonths: plan.durationMonths },
    })
    if (existing) {
      await prisma.subscriptionPlan.update({ where: { id: existing.id }, data: plan })
    } else {
      await prisma.subscriptionPlan.create({ data: plan })
    }
  }
}

export async function seedDefaultPlans() {
  for (let attempt = 1; attempt <= SEED_RETRY_ATTEMPTS; attempt += 1) {
    try {
      await seedPlansOnce()
      return
    } catch (error) {
      if (error.code === "P2021") {
        throw new Error(
          "Database tables are missing. Run `npm run prisma:migrate` or restart with `npm run dev` so Prisma migrations are applied.",
        )
      }

      if (!isDatabaseReachabilityError(error) || attempt === SEED_RETRY_ATTEMPTS) {
        throw error
      }

      console.warn(
        `Database unavailable while seeding plans. Retrying ${attempt}/${SEED_RETRY_ATTEMPTS - 1} in ${SEED_RETRY_DELAY_MS}ms.`,
      )
      await delay(SEED_RETRY_DELAY_MS)
    }
  }
}
