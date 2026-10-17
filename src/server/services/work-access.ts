import { and, eq, or, sql } from "drizzle-orm"
import { db } from "@/db"
import { projectMembers } from "@/db/schema/projects"
import { roles, team } from "@/db/schema/workspaces"
import * as accessService from "@/server/services/access-service"
import type { WorkPermissionFacts } from "./work-permissions"

/**
 * The DB-backed resolver for the deliverable/task lane's permission facts.
 *
 * Composed of the gates that already exist — `access-service.resolveMembership`
 * for the workspace side, `project_members` for the project side — so a second
 * copy of a second gate never exists. Every service in this lane takes its
 * facts from here and its decisions from `work-permissions.ts`.
 */

export interface WorkAccess {
  role: string
  isOwner: boolean
  facts: WorkPermissionFacts
  /** The viewer's email, for project memberships that were created for an
   * invited person and later attached to their account by email. */
  viewerEmail: string | null
}

/**
 * Resolves the viewer's workspace-side facts, and — when a project is named —
 * their project membership. Membership rows match the account by `user_id` or
 * lowercased email: `project_members` has no FK to `team`, and both row shapes
 * exist (joined members carry a user id; invitees carry just an email until
 * verification backfills the account).
 */
export async function getWorkAccess(
  workspaceId: string,
  userId: string,
  projectId?: string | null
): Promise<WorkAccess | null> {
  const membership = await accessService.resolveMembership(workspaceId, userId)
  if (!membership) return null

  const isWorkspaceAdmin = membership.isOwner || membership.role === "admin"

  const teamRows = await db
    .select({ id: team.id, email: team.email })
    .from(team)
    .where(
      and(
        eq(team.workspaceId, workspaceId),
        eq(team.userId, userId),
        eq(team.status, "active"),
        // Same load-bearing clause as `resolveMembership`: an invitee's seat
        // must not drive deliverable ownership before they accept.
        sql`${team.joinedAt} IS NOT NULL`
      )
    )
    .limit(1)
  const teamRow = teamRows.length > 0 ? teamRows[0] : null

  const facts: WorkPermissionFacts = {
    isWorkspaceAdmin,
    isProjectLead: false,
    isProjectMember: false,
    viewerTeamId: teamRow?.id ?? null,
  }

  const viewerEmail = teamRow?.email ?? null

  if (!projectId) {
    return { role: membership.role, isOwner: membership.isOwner, facts, viewerEmail }
  }

  const rows = await db
    .select({ id: projectMembers.id, roleTitle: roles.title })
    .from(projectMembers)
    .innerJoin(roles, eq(projectMembers.roleId, roles.id))
    .leftJoin(
      team,
      and(
        eq(team.workspaceId, workspaceId),
        eq(team.status, "active"),
        or(
          eq(team.userId, projectMembers.userId),
          sql`lower(${team.email}) = lower(${projectMembers.email})`
        )
      )
    )
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.status, "active"),
        or(
          eq(projectMembers.userId, userId),
          viewerEmail
            ? sql`lower(${projectMembers.email}) = lower(${viewerEmail})`
            : sql`false`
        )
      )
    )

  facts.isProjectMember = rows.length > 0
  facts.isProjectLead = rows.some((row) => row.roleTitle === "lead")

  return { role: membership.role, isOwner: membership.isOwner, facts, viewerEmail }
}

/** Resolver that throws: the shape every write wants at its first line. */
export async function requireWorkAccess(
  workspaceId: string,
  userId: string,
  projectId?: string | null
): Promise<WorkAccess> {
  const access = await getWorkAccess(workspaceId, userId, projectId)
  if (!access) throw new Error("Workspace not found or you do not have access.")
  return access
}
