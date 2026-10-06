const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** Compact relative time: "just now", "12m", "3h", "5d", then a date. */
export function formatRelativeTime(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value
  const diff = Date.now() - date.getTime()

  if (diff < MINUTE) return "just now"
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d ago`

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })
}

export function formatDueDate(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })
}

export function isOverdue(dueDate: Date | string | null): boolean {
  if (!dueDate) return false
  const date = typeof dueDate === "string" ? new Date(dueDate) : dueDate
  return date.getTime() < Date.now()
}
