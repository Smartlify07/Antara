import type { LibraryApprovalState } from "@/lib/library-schemas"

/**
 * How the library's asset-level approval states look (FR-039..041). Lane-
 * local like `version-meta.ts` in the deliverables lane, and deliberate
 * about it: these describe the ASSET — the state of its whole history,
 * derived server-side (`assetApprovalState`) — while the version chips label
 * a single version row. Muted rather than alarming: a library glance should
 * read as fact-finding, not as a wall of alarms.
 */
export const ASSET_STATE_META: Record<
  LibraryApprovalState,
  { label: string; badgeClass: string; hint: string; dot: string }
> = {
  approved: {
    label: "Approved",
    badgeClass:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    hint: "A version of this file has been approved.",
    dot: "bg-emerald-500",
  },
  not_approved: {
    label: "Not approved",
    badgeClass: "bg-muted text-muted-foreground",
    hint: "No version of this file has been approved yet.",
    dot: "bg-sky-500",
  },
  superseded: {
    label: "Superseded",
    badgeClass:
      "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    hint: "Reviewed work on this file was replaced by newer versions.",
    dot: "bg-muted-foreground/40",
  },
}
