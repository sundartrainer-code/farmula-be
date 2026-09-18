export function addMonths(date, months) {
  const next = new Date(date)
  const day = next.getDate()
  next.setMonth(next.getMonth() + months)
  if (next.getDate() < day) next.setDate(0)
  return next
}

export function addDays(date, days) {
  return new Date(new Date(date).getTime() + Number(days) * 24 * 60 * 60 * 1000)
}

export function subscriptionDurationDays(durationMonths) {
  return Number(durationMonths) * 30
}
