import type { RequestTriageStatus, TaskPriority } from "@/db/enums"

/**
 * How a triage status looks, for chips on the inbox and the detail header.
 * Lane-local on purpose: `status-meta.ts` is projects' shared ground (and
 * deliverables will want their own next increment) — request states travel
 * with the requests lane.
 */
export const REQUEST_META: Record<
  RequestTriageStatus,
  { label: string; badgeClass: string }
> = {
  open: {
    label: "Open",
    badgeClass: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  },
  needs_info: {
    label: "Needs info",
    badgeClass:
      "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
  accepted: {
    label: "Accepted",
    badgeClass:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  declined: {
    label: "Declined",
    badgeClass: "bg-muted text-muted-foreground",
  },
}

export const REQUEST_STATUS_ORDER: RequestTriageStatus[] = [
  "open",
  "needs_info",
  "accepted",
  "declined",
]

/**
 * Priority pills for the dialog's meta row — one tinted badge per priority.
 * Urgent is the strongest red, then orange, amber; low reads as quiet blue
 * so there's always a hue step between neighbours.
 */
export const PRIORITY_BADGE: Record<TaskPriority, string> = {
  urgent: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
  medium:
    "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  low: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
}
