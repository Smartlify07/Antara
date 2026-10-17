import type {
  DeliverableStatus,
  TaskPriority,
  TaskStatus,
} from "@/db/enums"

/**
 * How the work lane's statuses look, for chips on deliverable cards and task
 * rows. Lane-local on purpose — `status-meta.ts` is projects' shared ground
 * and request states travel with the requests lane (`request-meta.ts`); these
 * are the production states (§8.1) and task states (FR-016).
 */
export const DELIVERABLE_META: Record<
  DeliverableStatus,
  { label: string; badgeClass: string }
> = {
  planned: {
    label: "Planned",
    badgeClass: "bg-muted text-muted-foreground",
  },
  in_progress: {
    label: "In progress",
    badgeClass:
      "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  },
  blocked: {
    label: "Blocked",
    badgeClass:
      "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  },
  ready_for_review: {
    label: "Ready for review",
    badgeClass:
      "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  },
  changes_requested: {
    label: "Changes requested",
    badgeClass:
      "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
  completed: {
    label: "Completed",
    badgeClass:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
}

/** Moves the chip may offer — mirroring `workflow-states.ts`' machine. */
export const DELIVERABLE_STATUS_ORDER: DeliverableStatus[] = [
  "planned",
  "in_progress",
  "blocked",
  "ready_for_review",
  "changes_requested",
  "completed",
]

export const TASK_STATUS_META: Record<
  TaskStatus,
  { label: string; badgeClass: string }
> = {
  backlog: { label: "Backlog", badgeClass: "bg-muted text-muted-foreground" },
  todo: {
    label: "To do",
    badgeClass: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  },
  in_progress: {
    label: "In progress",
    badgeClass:
      "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  },
  done: {
    label: "Done",
    badgeClass:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  approved: {
    label: "Approved",
    badgeClass:
      "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  },
}

export const TASK_STATUS_ORDER: TaskStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "done",
  "approved",
]

export const TASK_PRIORITY_META: Record<
  TaskPriority,
  { label: string; badgeClass: string }
> = {
  low: { label: "Low", badgeClass: "bg-muted text-muted-foreground" },
  medium: { label: "Medium", badgeClass: "bg-muted text-muted-foreground" },
  high: {
    label: "High",
    badgeClass:
      "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
  urgent: {
    label: "Urgent",
    badgeClass:
      "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  },
}

/** Legal moves for the chip's menu: everything except where it already is. */
export function taskMoveTargets(current: TaskStatus): TaskStatus[] {
  return TASK_STATUS_ORDER.filter((status) => status !== current)
}

/** Legal moves for the production chip: the machine's targets from here. */
export function deliverableMoveTargets(
  current: DeliverableStatus
): DeliverableStatus[] {
  // Kept in sync — but not duplicated — with DELIVERABLE_FROM in
  // workflow-states.ts: the client copy is a UI affordance, the server's
  // assertDeliverableTransition is the authority.
  const FROM: Record<DeliverableStatus, DeliverableStatus[]> = {
    planned: ["in_progress", "blocked", "completed"],
    in_progress: ["blocked", "ready_for_review", "completed", "planned"],
    blocked: ["in_progress", "completed"],
    ready_for_review: ["changes_requested", "in_progress", "completed"],
    changes_requested: ["in_progress", "ready_for_review", "completed"],
    completed: [],
  }
  return FROM[current]
}
