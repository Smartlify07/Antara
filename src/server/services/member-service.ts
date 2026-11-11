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
import { checkMemberAction } from "./member-guards"

/**
 * Workspace member management: change a role, remove a member.
 *
 * Pure DB operations plus the guard table — no HTTP, no session. The thin
 * server functions own the session gate.
 *
 * Three invariants this file is built around:
 *
 * - The owner is never a target. Their capability comes from `workspaces.owner_id`
 *   (`resolveMembership` grants admin to the owner regardless of any role row),
 *   so mutating their membership row would change nothing in the UI and
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
 * The owner counts even without a seat row: `resolveMembership` grants them
 * admin from `workspaces.owner_id`, not from `team`, so a legacy workspace
 * where the owner never got a row still isn't treated as orphaned.
 *
 * `ownerLeftAt` is deliberately ignored, because `resolveMembership` ignores it
 * too — an owner flagged as "left" can still manage this workspace, so counting
 * them out here would refuse a removal the owner is entitled to make. That the
 * flag does not actually suspend an owner's access is recorded as an open
 * question in DESIGN.md.
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
  return rows.length + (ownerHasSeat ? 0 : 1)
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
