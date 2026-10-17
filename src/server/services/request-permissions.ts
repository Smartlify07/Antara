import type { Membership } from "@/server/services/access-service"

/**
 * Request-triage permissions as pure predicates.
 *
 * Split out of `request-service.ts` — which imports the database — so the
 * permission matrix is testable without env vars or a DB, per the same
 * logic that keeps the state machines in `workflow-states.ts` pure. The
 * service re-exports these, so callers have one import surface.
 */

/**
 * Triage is an administrator's job: the workspace owner (admin by fact) or
 * anyone holding an admin/lead workspace role. Deliberately not
 * project-scoped — a request has no project of its own while triage happens.
 */
export function canTriage(membership: {
  role: string
  isOwner: boolean
}): boolean {
  return (
    membership.isOwner ||
    membership.role === "admin" ||
    membership.role === "lead"
  )
}

/**
 * Any member may post on a request's brief thread — the requester answering,
 * the lead asking. The thread is the clarification record triage rests on
 * (FR-009). A null membership was already rejected by `requireWorkspaceAccess`;
 * this predicate exists for UI that wants to know before asking.
 */
export function canPostOnRequest(membership: Membership | null): boolean {
  return membership !== null
}
