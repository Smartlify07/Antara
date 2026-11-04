/**
 * The project page's URL vocabulary, so a notification can open the exact
 * piece of work it is about instead of dropping the reader on Overview.
 *
 * `?tab=work&deliverable=<id>&version=<id>` is what the inbox links to: the
 * Work tab mounts the cabinet, the deliverable id selects its level-one
 * pane, and the version id drills into that version's detail. Params fall
 * open rather than hard-failing navigation — a stale link still opens the
 * project, it just opens it without the pane.
 */
export interface ProjectDetailSearch {
  tab?: "overview" | "work"
  deliverable?: string
  version?: string
}

function param(
  search: Record<string, unknown>,
  key: string
): string | undefined {
  const value = search[key]
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export function parseProjectDetailSearch(
  search: Record<string, unknown>
): ProjectDetailSearch {
  const deliverable = param(search, "deliverable")
  // A version only means something inside a deliverable's cabinet.
  const version = deliverable ? param(search, "version") : undefined

  const requested = param(search, "tab")
  const tab =
    requested === "overview" || requested === "work"
      ? requested
      : deliverable
        ? "work"
        : undefined

  return { tab, deliverable, version }
}
