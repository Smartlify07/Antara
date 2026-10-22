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

/**
 * The date-only wire shape ("yyyy-mm-dd") from a calendar day. Uses the
 * picked day's own components so the chosen date is the stored date — a
 * `toISOString()` pass would shift UTC-zone machines into the previous day.
 */
export function toIsoDay(date: Date): string {
  const pad = (n: number) => `${n}`.padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** A date-only wire string as a local-midnight Date (calendar display). */
export function fromIsoDay(value: string): Date {
  return new Date(`${value}T00:00:00`)
}

export function isOverdue(dueDate: Date | string | null): boolean {
  if (!dueDate) return false
  const date = typeof dueDate === "string" ? new Date(dueDate) : dueDate
  return date.getTime() < Date.now()
}
