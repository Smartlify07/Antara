import type { VersionReviewStatus } from "@/db/enums"

/**
 * How the version lane's review states look, for chips on version rows and
 * the Reviews queue. Lane-local like `deliverable-meta.ts` and mirroring the
 * workflow machine's vocabulary — the service is the authority; these only
 * label what it stamped.
 */
export const REVIEW_STATUS_META: Record<
  VersionReviewStatus,
  { label: string; badgeClass: string }
> = {
  submitted: {
    label: "In review",
    badgeClass:
      "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  },
  approved: {
    label: "Approved",
    badgeClass:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  rejected: {
    label: "Rejected",
    badgeClass: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  },
  changes_requested: {
    label: "Changes requested",
    badgeClass:
      "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
  superseded: {
    label: "Superseded",
    badgeClass: "bg-muted text-muted-foreground",
  },
}

/** The decisions a lead/admin may record, with their friendly verbs. */
export const DECISION_META: Record<
  "approved" | "rejected" | "changes_requested",
  { label: string; description: string }
> = {
  approved: {
    label: "Approve",
    description:
      "Records an approval tied to this exact version. The history on older versions stays.",
  },
  rejected: {
    label: "Reject",
    description:
      "Records a rejection tied to this exact version. The history on older versions stays.",
  },
  changes_requested: {
    label: "Request changes",
    description:
      "Sends it back for changes. Anything you write below lands on the version's feedback thread.",
  },
}

/** Filled dot for the borderless thread views — no chip box needed. */
export const REVIEW_DOTS: Record<VersionReviewStatus, string> = {
  submitted: "bg-blue-500",
  approved: "bg-emerald-500",
  rejected: "bg-red-500",
  changes_requested: "bg-amber-500",
  superseded: "bg-muted-foreground/40",
}
