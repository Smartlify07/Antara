/**
 * The inbox's keyset cursor: the `(createdAt, id)` pair the list is ordered
 * by. It is opaque to the client — the query hands it back exactly as the
 * server issued it — and tolerant on parse: a hand-edited or truncated cursor
 * restarts the list at the top instead of erroring the page.
 */
export interface NotificationCursor {
  createdAt: Date
  id: string
}

/** ISO timestamps never contain this, so the first separator is unambiguous. */
const SEPARATOR = "|"

export function encodeNotificationCursor(createdAt: Date, id: string): string {
  return `${createdAt.toISOString()}${SEPARATOR}${id}`
}

export function parseNotificationCursor(
  raw: string | null | undefined
): NotificationCursor | null {
  if (!raw) return null

  const separator = raw.indexOf(SEPARATOR)
  if (separator <= 0) return null

  const createdAt = new Date(raw.slice(0, separator))
  const id = raw.slice(separator + 1).trim()
  if (Number.isNaN(createdAt.getTime()) || id.length === 0) return null

  return { createdAt, id }
}
