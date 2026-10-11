import { and, eq, isNotNull, isNull } from "drizzle-orm"
import { db } from "@/db"
import { roles, team, workspaces } from "@/db/schema/index"

export interface Membership {
  /** Workspace-scope role title, or "admin" for the owner. */
  role: string
  isOwner: boolean
}

/**
 * The one definition of "this person is in this workspace".
 *
 * Exists because this check was written twice — once here-by-accident in
 * `project-service` and once in `workspace-service` — and the two copies
 * disagreed about what a seat row means. One of them accepted any row with a
 * matching `user_id`; the other at least required an active status. Neither
 * looked at `joined_at`, so a reserved seat granted access to a workspace the
 * recipient had never agreed to join.
 *
 * Every caller must go through here. A second copy is a second bug.
 */
export async function resolveMembership(
  workspaceId: string,
  userId: string
): Promise<Membership | null> {
  const [owned] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(
      and(
        eq(workspaces.id, workspaceId),
        eq(workspaces.ownerId, userId),
        isNull(workspaces.deletedAt)
      )
    )
    .limit(1)

  // The owner is not a member row, so they are resolved separately.
  if (owned) return { role: "admin", isOwner: true }

  const [membership] = await db
    .select({ title: roles.title })
    .from(team)
    .innerJoin(roles, eq(team.roleId, roles.id))
    .innerJoin(workspaces, eq(team.workspaceId, workspaces.id))
    .where(
      and(
        eq(team.workspaceId, workspaceId),
        eq(team.userId, userId),
        eq(team.status, "active"),
        // Load-bearing. `createInvite` reserves a seat and the verification
        // backfill attaches an account to it; both leave `joined_at` null. That
        // row satisfies every other condition here — correct person, live
        // workspace, active status — so without this clause an invitee could
        // skip the Accept button and use the workspace directly.
        isNotNull(team.joinedAt),
        isNull(workspaces.deletedAt)
      )
    )
    .limit(1)

  if (!membership) return null
  return { role: membership.title, isOwner: false }
}

/**
 * Throws unless the caller is a member. For callers that only need the
 * yes/no answer.
 */
export async function requireWorkspaceAccess(
  workspaceId: string,
  userId: string
): Promise<Membership> {
  const membership = await resolveMembership(workspaceId, userId)
  if (!membership) {
    throw new Error("Workspace not found or you do not have access.")
  }
  return membership
}
