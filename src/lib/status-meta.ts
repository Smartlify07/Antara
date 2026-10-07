import {
  ActivityIcon,
  ArchiveIcon,
  CircleCheckIcon,
  PauseCircleIcon,
  SparklesIcon,
} from "lucide-react"
import type { ProjectStatus } from "@/db/enums"

/**
 * Single source of truth for how a project status looks. The create-form
 * dropdown, the chip, and the project cards all read from here so a status
 * never renders with two different colours or icons.
 */

type StatusIcon = typeof SparklesIcon

export interface StatusMeta {
  label: string
  icon: StatusIcon
  /** Icon + label colour, used on the chip and in the dropdown. */
  textClass: string
  /** Filled pill treatment, used for the status badge on cards. */
  badgeClass: string
}

export const PROJECT_STATUS_META: Record<ProjectStatus, StatusMeta> = {
  planning: {
    label: "Planning",
    icon: SparklesIcon,
    textClass: "text-violet-600 dark:text-violet-300",
    badgeClass:
      "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  },
  active: {
    label: "Active",
    icon: ActivityIcon,
    textClass: "text-emerald-600 dark:text-emerald-300",
    badgeClass:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  on_hold: {
    label: "On hold",
    icon: PauseCircleIcon,
    textClass: "text-amber-600 dark:text-amber-300",
    badgeClass:
      "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
  completed: {
    label: "Completed",
    icon: CircleCheckIcon,
    textClass: "text-sky-600 dark:text-sky-300",
    badgeClass: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  },
  archived: {
    label: "Archived",
    icon: ArchiveIcon,
    textClass: "text-muted-foreground",
    badgeClass: "bg-muted text-muted-foreground",
  },
}

export const PROJECT_STATUS_ORDER: ProjectStatus[] = [
  "planning",
  "active",
  "on_hold",
  "completed",
  "archived",
]
