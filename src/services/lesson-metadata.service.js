import crypto from "node:crypto"

const INTRODUCTION_PATTERN = /\b(introduction|intro|welcome|start[\s_-]*here)\b/i
const EPISODE_PATTERN = /\b(episode|ep|lesson|lecture)[\s_-]*0*(\d+)\b/i
const NUMBER_PATTERN = /[0-9\u0C66-\u0C6F]+/u
const TELUGU_ZERO_CODE_POINT = 0x0C66

function baseTitle(fileName) {
  return fileName
    .split("/")
    .pop()
    .replace(/\.[^/.]+$/, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function normalizeNumber(value) {
  return Array.from(value)
    .map((character) => {
      const codePoint = character.codePointAt(0)
      if (codePoint >= TELUGU_ZERO_CODE_POINT && codePoint <= TELUGU_ZERO_CODE_POINT + 9) {
        return String(codePoint - TELUGU_ZERO_CODE_POINT)
      }
      return character
    })
    .join("")
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds || 0)))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const remainder = String(total % 60).padStart(2, "0")
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${remainder}`
    : `${String(minutes).padStart(2, "0")}:${remainder}`
}

export const lessonMetadataService = {
  parse(fileName) {
    const rawTitle = baseTitle(fileName)
    const isIntroduction = INTRODUCTION_PATTERN.test(rawTitle)
    const episodeMatch = rawTitle.match(EPISODE_PATTERN)
    const numberMatch = rawTitle.match(NUMBER_PATTERN)
    const lessonNumber = isIntroduction
      ? 0
      : episodeMatch
        ? Number.parseInt(episodeMatch[2], 10)
        : numberMatch
          ? Number.parseInt(normalizeNumber(numberMatch[0]), 10)
          : null
    const title = rawTitle
    const baseSlug = slugify(title) || "lesson"
    const suffix = crypto.createHash("sha1").update(fileName.toLowerCase()).digest("hex").slice(0, 8)

    return {
      title,
      slug: `${baseSlug}-${suffix}`,
      lessonNumber,
      isIntroduction,
      sortOrder: isIntroduction ? 0 : lessonNumber ?? 100000,
    }
  },
}
