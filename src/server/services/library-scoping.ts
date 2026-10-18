import type { VersionReviewStatus } from "@/db/enums"
import type { LibraryApprovalState } from "@/lib/library-schemas"
import { LIBRARY_APPROVAL_STATES } from "@/lib/library-schemas"

/**
 * The Library's pure contracts (FR-039..044), split off from
 * `library-service.ts` by the lane's own convention: the questions a filter
 * or a history must answer are database-free and testable without one, in
 * the same split as `work-permissions.ts` (pure) vs `work-access.ts` (DB).
 */

/**
 * An asset's approval state, derived from the review statuses across ALL of
 * its versions — the same rows the version timeline shows one by one.
 *
 * The derivation leans on the version lane's machine rule: a new submission
 * SUPersedes every earlier review state of the asset, and a superseded
 * version can never take a decision (assertVersionDecidable throws). That
 * guarantees "a version whose status is `approved` still exists" holds
 * exactly while the newest reviewed work is approved, and the three states
 * below are mutually exclusive and exhaustive:
 *
 * - `approved`     — a live approved version exists (nothing newer submitted).
 * - `superseded`   — the reviewed work has been replaced by newer versions
 *                    that have not (yet) been approved; the asset carries
 *                    superseded rows and no live approval.
 * - `not_approved` — the asset never produced an approval. Drafts, versions
 *                    awaiting review, rejections and change requests all sit
 *                    here; "not approved" is the honest bucket, not a pass.
 */
export const ASSET_APPROVAL_STATES = LIBRARY_APPROVAL_STATES

export function assetApprovalState(
  statuses: (VersionReviewStatus | null)[]
): LibraryApprovalState {
  const seen = new Set(
    statuses.filter((status): status is VersionReviewStatus => status !== null)
  )
  if (seen.has("approved")) return "approved"
  if (seen.has("superseded")) return "superseded"
  return "not_approved"
}

/**
 * FR-037 as a fact, not a display guess: on a newest-first version list,
 * `isLatest` is the first row and `isLatestApproved` is the newest version
 * that was ever approved — often NOT the latest. Same rule the version
 * timeline computes inline (version-service's `listDeliverableVersions`);
 * the library state mirrors it rather than reinventing it.
 */
export interface VersionFlags {
  isLatest: boolean
  isLatestApproved: boolean
}

export function annotateVersionFlags<
  T extends { reviewStatus: VersionReviewStatus | null },
>(newestFirst: T[]): (T & VersionFlags)[] {
  const firstApprovedIndex = newestFirst.findIndex(
    (version) => version.reviewStatus === "approved"
  )
  return newestFirst.map((version, index) => ({
    ...version,
    isLatest: index === 0,
    isLatestApproved: index === firstApprovedIndex && firstApprovedIndex !== -1,
  }))
}

/**
 * The substring pattern for the metadata search, with LIKE wildcards in the
 * user's own words escaped so `50%_upload` finds a filename, not a mask.
 * Postgres' default escape character (backslash) is the one ILIKE uses,
 * since the query never overrides it.
 */
export function librarySearchPattern(term: string): string | null {
  const trimmed = term.trim()
  if (trimmed.length === 0) return null
  const escaped = trimmed.replace(/[\\%_]/g, (char) => `\\${char}`)
  return `%${escaped}%`
}
