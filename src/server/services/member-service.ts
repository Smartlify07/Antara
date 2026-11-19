import { and, eq, ne } from "drizzle-orm"
import { db } from "@/db"
import { roles, team, workspaces } from "@/db/schema/index"
import type { TeamMembership, Workspace } from "@/db/schema/index"
import { SYSTEM_ROLE_ADMIN } from "@/db/seed"
import { resolveMembership } from "@/server/services/access-service"
import {
  InviteError,
  resolveWorkspaceRole,
} from "@/server/services/invite-service"
import type { MemberAction, MemberRejectionCode } from "./member-guards"
import { checkMemberAction, checkSelfLeave } from "./member-guards"

/**
 * Workspace member management: change a role, remove a member.
 *
 * Pure DB operations plus the guard table — no HTTP, no session. The thin
 * server functions own the session gate.
 *
 * Three invariants this file is built around:
 *
 * - The owner is never a target. Their capability comes from `workspaces.owner_id`
 *   (`resolveMembership` grants admin to the owner while `owner_left_at` is
 *   null), so mutating their membership row would change nothing in the UI and
 *   everything in the audit trail.
 * - Removal is `status = 'left'`, never a delete. Every access path already
 *   filters that status (`resolveMembership`, `work-access`, project joins), and
 *   the row is what keeps a real name on the versions and comments the person
 *   authored.
 * - Roles are resolved by *title*, through `resolveWorkspaceRole`, so a
 *   project-scope `lead`/`member` can never be attached to a workspace seat.
 */

export type MemberErrorCode =
  "not_found" | "not_an_admin" | "invalid_role" | MemberRejectionCode

export class MemberError extends Error {
  constructor(
    message: string,
    readonly code: MemberErrorCode
  ) {
    super(message)
    this.name = "MemberError"
  }
}

interface MemberTarget {
  workspace: Workspace
  membership: TeamMembership
  /** The seat's current workspace-scope role title. */
  roleTitle: string
}

async function loadTarget(
  workspaceId: string,
  membershipId: string
): Promise<MemberTarget> {
  const rows = await db
    .select({ workspace: workspaces, membership: team, roleTitle: roles.title })
    .from(team)
    .innerJoin(workspaces, eq(team.workspaceId, workspaces.id))
    .innerJoin(roles, eq(team.roleId, roles.id))
    // Scoped to the workspace on purpose: a membership id from another
    // workspace must read as missing, not as a target.
    .where(and(eq(team.id, membershipId), eq(team.workspaceId, workspaceId)))
    .limit(1)

  if (rows.length === 0) {
    throw new MemberError("That member isn't in this workspace.", "not_found")
  }
  const row = rows[0]

  return {
    workspace: row.workspace,
    membership: row.membership,
    roleTitle: row.roleTitle,
  }
}

/**
 * The actor gate. `resolveMembership` is the single definition of "is in this
 * workspace"; this only adds the "may manage" half on top of it.
 */
async function requireManager(
  workspaceId: string,
  actorUserId: string
): Promise<void> {
  const actor = await resolveMembership(workspaceId, actorUserId)
  if (!actor || (!actor.isOwner && actor.role !== SYSTEM_ROLE_ADMIN)) {
    throw new MemberError(
      "Only workspace admins can manage members.",
      "not_an_admin"
    )
  }
}

/**
 * Managers who would remain if `targetId` stopped being one.
 *
 * The owner counts even without a seat row, unless they have left: with the
 * flag set, `resolveMembership` no longer grants the owner's admin, so counting
 * them here would allow a change nobody would be left to undo. A dormant owner
 * who kept an ordinary admin seat is still counted — through that row, which is
 * the role they would actually act with.
 */
async function countRemainingManagers(
  workspace: Workspace,
  targetId: string
): Promise<number> {
  const rows = await db
    .select({ userId: team.userId })
    .from(team)
    .innerJoin(roles, eq(team.roleId, roles.id))
    .where(
      and(
        eq(team.workspaceId, workspace.id),
        eq(team.status, "active"),
        eq(roles.scope, "workspace"),
        eq(roles.title, SYSTEM_ROLE_ADMIN),
        ne(team.id, targetId)
      )
    )

  const ownerHasSeat = rows.some((row) => row.userId === workspace.ownerId)
  const ownerStillManages = workspace.ownerLeftAt === null && !ownerHasSeat
  return rows.length + (ownerStillManages ? 1 : 0)
}

function targetFacts(
  action: MemberAction,
  target: MemberTarget,
  actorUserId: string,
  remainingManagers: number
) {
  return {
    action,
    isOwner: target.membership.userId === target.workspace.ownerId,
    isSelf: target.membership.userId === actorUserId,
    isPending: target.membership.joinedAt === null,
    currentRole: target.roleTitle,
    currentStatus: target.membership.status,
    remainingManagers,
  }
}

function assertAllowed(
  facts: ReturnType<typeof targetFacts>,
  nextRole?: string
): void {
  const rejection = checkMemberAction({ ...facts, nextRole })
  if (rejection) throw new MemberError(rejection.message, rejection.code)
}

export interface ChangeMemberRoleInput {
  workspaceId: string
  membershipId: string
  actorUserId: string
  /** Workspace-scope role title, e.g. "admin" or "member". */
  roleTitle: string
}

export async function changeMemberRole({
  workspaceId,
  membershipId,
  actorUserId,
  roleTitle,
}: ChangeMemberRoleInput): Promise<{ roleTitle: string }> {
  await requireManager(workspaceId, actorUserId)
  const target = await loadTarget(workspaceId, membershipId)

  const nextRole = await resolveWorkspaceRole(workspaceId, roleTitle).catch(
    (error: unknown) => {
      if (error instanceof InviteError) {
        // The resolver's message is written for the invite dialog; the guard
        // here needs the same check with wording that fits a role change.
        throw new MemberError(
          "That role isn't available in this workspace.",
          "invalid_role"
        )
      }
      throw error
    }
  )

  assertAllowed(
    targetFacts(
      "change_role",
      target,
      actorUserId,
      await countRemainingManagers(target.workspace, target.membership.id)
    ),
    nextRole.title
  )

  await db
    .update(team)
    .set({ roleId: nextRole.id, updatedAt: new Date() })
    .where(eq(team.id, target.membership.id))

  return { roleTitle: nextRole.title }
}

export interface RemoveMemberInput {
  workspaceId: string
  membershipId: string
  actorUserId: string
}

/**
 * Ends someone's access without destroying their history. `joinedAt` is left
 * alone: it records when they joined, which is still true.
 */
export async function removeMember({
  workspaceId,
  membershipId,
  actorUserId,
}: RemoveMemberInput): Promise<void> {
  await requireManager(workspaceId, actorUserId)
  const target = await loadTarget(workspaceId, membershipId)

  assertAllowed(
    targetFacts(
      "remove",
      target,
      actorUserId,
      await countRemainingManagers(target.workspace, target.membership.id)
    )
  )

  await db
    .update(team)
    .set({ status: "left", updatedAt: new Date() })
    .where(
      and(eq(team.id, target.membership.id), eq(team.workspaceId, workspaceId))
    )
}

export interface MemberSuspensionInput {
  workspaceId: string
  membershipId: string
  actorUserId: string
}

/**
 * Pauses someone's access without touching their seat.
 *
 * Suspension is not removal: the row stays, the role stays, `joinedAt` stays,
 * and signing in is still possible — but `resolveMembership` only accepts
 * `status = 'active'`, so every workspace route, server function and project
 * access refuses them until they are unsuspended. That is why this needs no
 * session surgery: the gate is downstream of the status, not of the cookie.
 */
export async function suspendMember({
  workspaceId,
  membershipId,
  actorUserId,
}: MemberSuspensionInput): Promise<void> {
  await requireManager(workspaceId, actorUserId)
  const target = await loadTarget(workspaceId, membershipId)

  assertAllowed(
    targetFacts(
      "suspend",
      target,
      actorUserId,
      await countRemainingManagers(target.workspace, target.membership.id)
    )
  )

  await db
    .update(team)
    .set({ status: "suspended", updatedAt: new Date() })
    .where(
      and(eq(team.id, target.membership.id), eq(team.workspaceId, workspaceId))
    )
}

/** Restores a suspended seat. The role and history were never removed. */
export async function unsuspendMember({
  workspaceId,
  membershipId,
  actorUserId,
}: MemberSuspensionInput): Promise<void> {
  await requireManager(workspaceId, actorUserId)
  const target = await loadTarget(workspaceId, membershipId)

  assertAllowed(
    targetFacts(
      "unsuspend",
      target,
      actorUserId,
      // Unsuspending can only add a manager, so this count never refuses it;
      // it is passed for completeness rather than as a live constraint.
      await countRemainingManagers(target.workspace, target.membership.id)
    )
  )

  await db
    .update(team)
    .set({ status: "active", updatedAt: new Date() })
    .where(
      and(eq(team.id, target.membership.id), eq(team.workspaceId, workspaceId))
    )
}

/**
 * Managers who would remain if this person left — counting seats only, since
 * the person is the caller rather than a target.
 *
 * Unlike `countRemainingManagers`, the owner is added only when they are
 * somebody else and still active. A dormant owner adds nothing, and an owner
 * leaving is not their own safety net.
 */
async function countManagersAfterLeaving(
  workspace: Workspace,
  actorUserId: string
): Promise<number> {
  const rows = await db
    .select({ userId: team.userId })
    .from(team)
    .innerJoin(roles, eq(team.roleId, roles.id))
    .where(
      and(
        eq(team.workspaceId, workspace.id),
        eq(team.status, "active"),
        eq(roles.scope, "workspace"),
        eq(roles.title, SYSTEM_ROLE_ADMIN),
        ne(team.userId, actorUserId)
      )
    )

  const ownerHasSeat = rows.some((row) => row.userId === workspace.ownerId)
  const ownerAdds =
    workspace.ownerId !== actorUserId &&
    workspace.ownerLeftAt === null &&
    !ownerHasSeat
  return rows.length + (ownerAdds ? 1 : 0)
}

export interface LeaveWorkspaceInput {
  workspaceId: string
  actorUserId: string
}

/**
 * Leaves, as the person themselves.
 *
 * Not a removal: nobody else can do this for you, and the row is kept so the
 * work you authored still resolves to a name. The seat goes to `left`; an owner
 * additionally has `owner_left_at` stamped, which is what makes their ownership
 * dormant rather than deleted — the workspace keeps running under whoever they
 * promoted first.
 *
 * `joined_at` is left alone, like removal: it records when they joined, which
 * is still true.
 */
export async function leaveWorkspace({
  workspaceId,
  actorUserId,
}: LeaveWorkspaceInput): Promise<void> {
  const membership = await resolveMembership(workspaceId, actorUserId)
  if (!membership) {
    throw new MemberError("You're not a member of this workspace.", "not_found")
  }

  const workspaceRows = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1)
  if (workspaceRows.length === 0) {
    throw new MemberError("That workspace no longer exists.", "not_found")
  }
  const workspace = workspaceRows[0]

  const seatRows = await db
    .select({ id: team.id })
    .from(team)
    .where(
      and(
        eq(team.workspaceId, workspaceId),
        eq(team.userId, actorUserId),
        ne(team.status, "left")
      )
    )
    .limit(1)
  const seat = seatRows.length > 0 ? seatRows[0] : null

  const rejection = checkSelfLeave({
    isManager: membership.isOwner || membership.role === SYSTEM_ROLE_ADMIN,
    isOwner: membership.isOwner,
    remainingManagers: await countManagersAfterLeaving(workspace, actorUserId),
  })
  if (rejection) throw new MemberError(rejection.message, rejection.code)

  const now = new Date()
  await db.transaction(async (tx) => {
    if (seat) {
      await tx
        .update(team)
        .set({ status: "left", updatedAt: now })
        .where(eq(team.id, seat.id))
    }
    if (membership.isOwner) {
      await tx
        .update(workspaces)
        .set({ ownerLeftAt: now, updatedAt: now })
        .where(eq(workspaces.id, workspaceId))
    }
  })
}
