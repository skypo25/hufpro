export function getCurrentWeekRange() {
  const now = new Date()
  const day = now.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day

  const weekStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + diffToMonday
  )

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 7)

  return { weekStart, weekEnd }
}