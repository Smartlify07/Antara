import type { TaskStatus } from "@/db/enums"

/**
 * The permission predicates for the deliverable/task lane (FR-013..016, 052).
 * Pure by the same philosophy as `workflow-states.ts`: these are the questions
 * the service must answer before every write, and they are testable without a
 * database. The DB-backed resolver that produces the facts lives in
 * `work-access.ts`; the service layers re-export for one import surface.
 *
 * The plan's permission matrix names "project lead (+ workspace admin)" for
 * deliverables; production-status moves additionally respect the deliverable's
 * own owner, because the person carrying the deadline cannot be the one whose
 * status chip is frozen. Tasks are project-level collaboration: any project
 * member may create, assign and move them, and assignment is limited to
 * project members regardless of who holds the pen.
 */

export interface WorkPermissionFacts {
  /** Workspace owner or the seeded `admin` role. */
  isWorkspaceAdmin: boolean
  /** A `project_members` row with the seeded `lead` project role. */
  isProjectLead: boolean
  /** Any active `project_members` row. */
  isProjectMember: boolean
  /** The viewer's active `team.id`, when they have one — deliverable owners
   * are team rows, so owner-matching needs the id. */
  viewerTeamId: string | null
}

/** Deliverable create/owner/deadline writes. */
export function canManageDeliverables(facts: WorkPermissionFacts): boolean {
  return facts.isWorkspaceAdmin || facts.isProjectLead
}

/**
 * Version submission (FR-020/026). The deliverable's own owner carries the
 * work, so they send versions of it; the (+ leads) in the plan's permission
 * row covers admin/lead oversight exactly as deliverable management does.
 */
export function canSubmitVersion(
  facts: WorkPermissionFacts,
  ownerTeamId: string | null
): boolean {
  if (canManageDeliverables(facts)) return true
  return ownerTeamId !== null && ownerTeamId === facts.viewerTeamId
}

/**
 * Review decisions (FR-033). The plan's MVP rule: project lead (+ workspace
 * admin), and DELIBERATELY NOT the deliverable's own owner — the person who
 * submits the work cannot also sit as its reviewer. Named separately from
 * `canManageDeliverables` (which it currently matches) so a later permission
 * split is a change here, not a hunt.
 */
export function canDecideVersion(facts: WorkPermissionFacts): boolean {
  return facts.isWorkspaceAdmin || facts.isProjectLead
}

/** The production-status chip. Admin/lead, or the deliverable's own owner. */
export function canMoveProductionStatus(
  facts: WorkPermissionFacts,
  ownerTeamId: string | null
): boolean {
  if (canManageDeliverables(facts)) return true
  return ownerTeamId !== null && ownerTeamId === facts.viewerTeamId
}

/** Task create/assign/status moves: membership in the project is the gate. */
export function canWorkOnTasks(facts: WorkPermissionFacts): boolean {
  return facts.isWorkspaceAdmin || facts.isProjectMember
}

/**
 * Task status moves are freely allowed — creative work legitimately reopens a
 * done task when review bounces it — and every move is recorded in
 * `status_history`. The ONE forbidden move is identity: a no-op write that
 * also bumps nothing but the reader's confidence is exactly the audit-trail
 * lie the workflow machines refuse, so the chip must not offer it and the
 * service must not accept it.
 */
export function assertTaskStatusMove(from: TaskStatus, to: TaskStatus): void {
  if (from === to) {
    throw new Error(
      `That task is already '${to}'. Pick a different status to move it.`
    )
  }
}
