import type {
  DeliverableStatus,
  RequestTriageStatus,
  VersionReviewStatus,
} from "@/db/enums"

/**
 * The PRD's state machines (§8.1, §8.2) as pure transition guards.
 *
 * Kept separate from the services that use them so the ONE thing a workflow
 * can always be wrong about — moving a record into a state it was never meant
 * to reach — is testable without a database, and so every mutation site (and
 * every future Increment) encodes the same transitions rather than
 * re-inventing them ad hoc.
 *
 * Conventions:
 * - `upgrade` transitions are the states a record may move to; anything not
 *   listed is forbidden.
 * - Identity (`from === to`) is always forbidden: a no-op write that also
 *   bumps `updated_at` is a lie in the audit trail, and the UI should never
 *   offer it.
 * - Guard functions throw. Callers in server functions translate the message
 *   into a 4xx-ish error for the form the user filled in.
 */

function assertAllowed(
  machine: string,
  from: string,
  to: string,
  allowed: readonly string[]
): void {
  if (from === to || !allowed.includes(to)) {
    throw new Error(
      `Invalid ${machine} transition: ${from} → ${to}. Allowed: ${makeList(allowed)}.`
    )
  }
}

function makeList(states: readonly string[]): string {
  return states.map((s) => `'${s}'`).join(", ")
}

// ---------------------------------------------------------------------------
// Request triage (§6.1 step 1)
// ---------------------------------------------------------------------------

/**
 * open --needs info--> needs_info; the team can also accept or decline from
 * either. accepted and declined are terminal: an accepted request has become
 * work (a deliverable points at it) and must not silently reopen; a declined
 * request stays declined — the requester submits a new request instead.
 */
const REQUEST_FROM_OPEN = ["needs_info", "accepted", "declined"] as const
const REQUEST_FROM_NEEDS_INFO = ["open", "accepted", "declined"] as const
const REQUEST_TERMINAL: readonly RequestTriageStatus[] = [
  "accepted",
  "declined",
]

export function isRequestTerminal(status: RequestTriageStatus): boolean {
  return REQUEST_TERMINAL.includes(status)
}

export function assertRequestTriageTransition(
  from: RequestTriageStatus,
  to: RequestTriageStatus
): void {
  assertAllowed("request triage", from, to, [
    ...(from === "open" ? REQUEST_FROM_OPEN : []),
    ...(from === "needs_info" ? REQUEST_FROM_NEEDS_INFO : []),
    ...(REQUEST_TERMINAL.includes(from) ? [] : []),
  ])
}

// ---------------------------------------------------------------------------
// Deliverable production status (§8.1)
// ---------------------------------------------------------------------------

/**
 * The production dimension. Deliberately independent of version review state
 * (asset_versions.review_status): a deliverable can be `ready_for_review`
 * while one of its versions already came back `changes_requested`, and that
 * contradiction is the signal — "this deliverable was sent, churn is
 * happening".
 *
 * completed is terminal. Corrections to completed work are NEW versions on
 * their own review cycle (PRD §8.2), not a backwards flip here.
 */
const DELIVERABLE_FROM: Record<
  DeliverableStatus,
  readonly DeliverableStatus[]
> = {
  planned: ["in_progress", "blocked", "completed"],
  in_progress: ["blocked", "ready_for_review", "completed", "planned"],
  blocked: ["in_progress", "completed"],
  ready_for_review: ["changes_requested", "in_progress", "completed"],
  changes_requested: ["in_progress", "ready_for_review", "completed"],
  completed: [],
}

export function assertDeliverableTransition(
  from: DeliverableStatus,
  to: DeliverableStatus
): void {
  assertAllowed("deliverable status", from, to, DELIVERABLE_FROM[from])
}

// ---------------------------------------------------------------------------
// Version review status (§8.1, §8.2)
// ---------------------------------------------------------------------------

/**
 * submitted → approved | rejected | changes_requested | superseded.
 * A re-decision (changes_requested → approved, rejected → approved) is
 * legitimate and lands as a NEW row in `approvals`, which is why the version's
 * status may move that way; append-only history lives in that table.
 *
 * superseded is terminal and machine-assigned: when the next version of the
 * same asset is submitted, every earlier version flips to superseded in the
 * SAME transaction. No user action may press a version into superseded.
 *
 * Never submitted (status is NULL) is not a state here — such a version has
 * not entered the workflow and needs no guard.
 */
const VERSION_FROM_SUBMITTED = [
  "approved",
  "rejected",
  "changes_requested",
  "superseded",
] as const
const VERSION_FROM_REDECIDABLE = ["approved", "superseded"] as const

export function assertVersionReviewTransition(
  from: VersionReviewStatus,
  to: VersionReviewStatus
): void {
  if (from === "submitted") {
    assertAllowed("version review", from, to, VERSION_FROM_SUBMITTED)
    return
  }
  if (from === "changes_requested" || from === "rejected") {
    assertAllowed("version review", from, to, VERSION_FROM_REDECIDABLE)
    return
  }
  // approved: only supersede. superseded: terminal, machine-assigned.
  assertAllowed("version review", from, to, ["superseded"])
}

/**
 * The status every OTHER version of an asset holds once a new one is
 * submitted — or null when the previous version was never submitted, since a
 * draft that is replaced has no review state to supersede.
 */
export function supersededStatusFor(
  previous: VersionReviewStatus | null
): VersionReviewStatus | null {
  return previous === null ? null : "superseded"
}

/**
 * Guard for recording a decision: a version that has been superseded cannot
 * take one, no matter what the form said. The service must ALSO express this
 * in its UPDATE's WHERE clause — two users clicking in race is exactly the
 * case the column exists for.
 */
export function assertVersionDecidable(
  status: VersionReviewStatus | null
): void {
  if (status === "superseded") {
    throw new Error("That version was superseded and can no longer be decided.")
  }
}
