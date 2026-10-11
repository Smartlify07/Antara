import { and, desc, eq, isNotNull, isNull, ne, sql } from "drizzle-orm"
import { db } from "@/db"
import { resolveMembership } from "@/server/services/access-service"
import type { MembershipStatus } from "@/db/enums"
import { seedWorkspaceRoles } from "@/db/seed"
import {
  roles,
  team,
  user,
  workspaces,
  workspaceInvites,
  type Workspace,
} from "@/db/schema/index"

/**
 * Workspace domain logic. Pure DB operations only — no HTTP, no session.
 * Thin server functions in `src/server/functions` own auth and call in here.
 */

export interface CreateWorkspaceInput {
  name: string
  slug: string
  avatarUrl?: string | null
  ownerId: string
}

export async function isSlugAvailable(
  ownerId: string,
  slug: string
): Promise<boolean> {
  const rows = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(
      and(
        eq(workspaces.ownerId, ownerId),
        eq(workspaces.slug, slug),
        isNull(workspaces.deletedAt)
      )
    )
    .limit(1)
  return rows.length === 0
}

export async function createWorkspace(input: CreateWorkspaceInput) {
  return db.transaction(async (tx) => {
    const [workspace] = await tx
      .insert(workspaces)
      .values({
        title: input.name,
        slug: input.slug,
        avatarUrl: input.avatarUrl ?? null,
        ownerId: input.ownerId,
      })
      .returning()
    if (!workspace) throw new Error("Failed to create workspace.")

    const { admin } = await seedWorkspaceRoles(tx, workspace.id)
    if (!admin) throw new Error("Failed to seed workspace roles.")

    await tx.insert(team).values({
      workspaceId: workspace.id,
      userId: input.ownerId,
      roleId: admin.id,
      status: "active",
      joinedAt: new Date(),
    })

    return workspace
  })
}

export interface WorkspaceListItem {
  workspace: Workspace
  role: string | null
  isOwner: boolean
  membershipStatus: MembershipStatus | null
}

export async function listWorkspaces(
  userId: string
): Promise<WorkspaceListItem[]> {
  const items = new Map<string, WorkspaceListItem>()

  const owned = await db
    .select()
    .from(workspaces)
    .where(and(eq(workspaces.ownerId, userId), isNull(workspaces.deletedAt)))
  for (const workspace of owned) {
    items.set(workspace.id, {
      workspace,
      role: "admin",
      isOwner: true,
      membershipStatus: null,
    })
  }

  const memberRows = await db
    .select({ workspace: workspaces, role: roles, status: team.status })
    .from(team)
    .innerJoin(workspaces, eq(team.workspaceId, workspaces.id))
    .innerJoin(roles, eq(team.roleId, roles.id))
    .where(
      and(
        eq(team.userId, userId),
        ne(team.status, "left"),
        // A reserved seat exists before anyone accepts. Without this the
        // workspace appears in the switcher for someone who has been invited
        // but has not joined — visible membership for a decision they haven't
        // made yet.
        isNotNull(team.joinedAt),
        isNull(workspaces.deletedAt)
      )
    )
  for (const row of memberRows) {
    if (items.has(row.workspace.id)) continue
    items.set(row.workspace.id, {
      workspace: row.workspace,
      role: row.role.title,
      isOwner: false,
      membershipStatus: row.status,
    })
  }

  return [...items.values()]
}

export interface WorkspaceAccess {
  workspace: Workspace
  role: string
  isOwner: boolean
}

/**
 * The workspace this person should land on after signing in or verifying:
 * whichever they opened most recently. Returns null when they have none, which
 * the caller turns into the create-workspace form.
 *
 * Single query by design — this sits on the post-auth path, so it shouldn't
 * cost a second round trip after the session check.
 *
 * `nullsLast` is load-bearing. A workspace that has never been opened has a
 * NULL `lastOpenedAt`, and Postgres sorts nulls FIRST on `desc` by default, so
 * without it every never-opened workspace would outrank the ones actually
 * visited. The `createdAt` tiebreak preserves the old "newest wins" behaviour
 * for a fresh install where nothing has been opened yet.
 *
 * Mirrors `listWorkspaces`' filters so both agree on what counts as reachable:
 * soft-deleted workspaces and memberships that have been left are excluded.
 */
export async function resolveLandingWorkspace(
  userId: string
): Promise<string | null> {
  const rows = await db
    .select({ slug: workspaces.slug })
    .from(team)
    .innerJoin(workspaces, eq(team.workspaceId, workspaces.id))
    .where(
      and(
        eq(team.userId, userId),
        ne(team.status, "left"),
        // Same reason as `listWorkspaces`: a pending seat must not be able to
        // pick where `/dashboard` sends somebody. Landing a not-yet-member
        // inside the workspace is the consent gate with the gate removed.
        isNotNull(team.joinedAt),
        isNull(workspaces.deletedAt)
      )
    )
    // Written as a raw fragment rather than `desc(...)`: this Drizzle version
    // has no `nullsLast()` helper, and the clause has to be explicit anyway —
    // it's the whole reason the ordering is correct.
    .orderBy(
      sql`${team.lastOpenedAt} desc nulls last`,
      desc(workspaces.createdAt)
    )
    .limit(1)

  return rows[0]?.slug ?? null
}

/**
 * Records that this person has a workspace open. Unconditional — the caller
 * debounces, which coalesces rapid switching into a single write without the
 * staleness a server-side time guard would introduce.
 */
export async function touchWorkspace(
  userId: string,
  workspaceId: string
): Promise<void> {
  await db
    .update(team)
    .set({ lastOpenedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(team.userId, userId), eq(team.workspaceId, workspaceId)))
}

/**
 * Resolves a workspace by slug for a user. Slugs are unique per owner,
 * so an owned workspace wins; otherwise the first active membership match.
 * Returns null when the user has no access.
 */
export async function getWorkspaceBySlug(
  userId: string,
  slug: string
): Promise<WorkspaceAccess | null> {
  const rows = await db
    .select()
    .from(workspaces)
    .where(and(eq(workspaces.slug, slug), isNull(workspaces.deletedAt)))
    .limit(1)

  const workspace = rows[0]
  if (!workspace) return null

  // Membership rules live in `access-service` and only there. This used to
  // spell out its own version of the check, which is how a pending seat ended
  // up able to enter a workspace nobody had accepted yet.
  const membership = await resolveMembership(workspace.id, userId)
  if (!membership) return null

  return {
    workspace,
    role: membership.role,
    isOwner: membership.isOwner,
  }
}

/**
 * Resolves the live invite behind each pending seat.
 *
 * Matched on the seat's reserved address rather than a foreign key, because
 * `team` carries no `invitedBy` and no invite id — only `workspace_invites`
 * does. The pending-unique index guarantees at most one live invite per address
 * per workspace, so the match is unambiguous.
 *
 * Always sets `inviteId`, since revoking needs it. Sets `invitedByName` only
 * when asked.
 */
async function attachPendingInvites(
  items: WorkspaceMemberItem[],
  workspaceId: string,
  includeInviter: boolean
): Promise<void> {
  const pending = items.filter((i) => i.isPending && i.email)
  if (!pending.length) return

  const rows = await db
    .select({
      id: workspaceInvites.id,
      email: workspaceInvites.email,
      inviterName: user.name,
    })
    .from(workspaceInvites)
    .leftJoin(user, eq(workspaceInvites.invitedBy, user.id))
    .where(
      and(
        eq(workspaceInvites.workspaceId, workspaceId),
        isNull(workspaceInvites.acceptedAt)
      )
    )

  const byEmail = new Map(rows.map((r) => [r.email.toLowerCase(), r] as const))

  for (const item of items) {
    if (!item.isPending || !item.email) continue
    const invite = byEmail.get(item.email.toLowerCase())
    if (!invite) continue
    item.inviteId = invite.id
    if (includeInviter) item.invitedByName = invite.inviterName ?? null
  }
}

export interface WorkspaceMemberItem {
  id: string
  name: string | null
  email: string | null
  image: string | null
  role: string
  status: MembershipStatus
  isOwner: boolean
  /**
   * Reserved by invite but not yet claimed — no account attached, or attached
   * but the link hasn't been redeemed. Rendered in the same list as everyone
   * else with an "awaiting" badge, rather than in a separate section.
   */
  isPending: boolean
  /**
   * The live invite backing a pending seat. Null once accepted. Needed to
   * revoke, which takes an invite id rather than the membership id.
   */
  inviteId?: string | null
  /**
   * Who issued the invite. Populated only when `includeInviter` is set.
   *
   * Omitted entirely for callers who may not manage the workspace, rather than
   * sent and hidden in the UI: "invited by" is reconnaissance about who works
   * with whom, and a non-admin has no business holding it.
   */
  invitedByName?: string | null
}

export async function listWorkspaceMembers(
  workspaceId: string,
  includeInviter = false
): Promise<WorkspaceMemberItem[]> {
  const workspace = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1)
  const ws = workspace[0]
  if (!ws) return []

  const rows = await db
    .select({ membership: team, member: user, role: roles })
    .from(team)
    .leftJoin(user, eq(team.userId, user.id))
    .innerJoin(roles, eq(team.roleId, roles.id))
    .where(and(eq(team.workspaceId, workspaceId), ne(team.status, "left")))

  const items: WorkspaceMemberItem[] = rows.map((row) => ({
    id: row.membership.id,
    name: row.member?.name ?? null,
    email: row.member?.email ?? row.membership.email,
    image: row.member?.image ?? null,
    role: row.role.title,
    status: row.membership.status,
    isOwner: row.membership.userId === ws.ownerId,
    // Attached but not joined: the signup backfill resolves identity on
    // verification, but the link still has to be redeemed before they're in.
    isPending:
      row.membership.userId === null || row.membership.joinedAt === null,
  }))

  if (items.some((i) => i.isPending)) {
    await attachPendingInvites(items, workspaceId, includeInviter)
  }

  const ownerCovered = items.some((item) => item.isOwner)
  if (!ownerCovered) {
    const [owner] = await db
      .select()
      .from(user)
      .where(eq(user.id, ws.ownerId))
      .limit(1)
    if (owner) {
      items.unshift({
        id: `owner-${ws.ownerId}`,
        name: owner.name,
        email: owner.email,
        image: owner.image,
        role: "admin",
        status: "active",
        isOwner: true,
        isPending: false,
      })
    }
  }

  return items
}
