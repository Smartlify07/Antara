import { and, eq, isNull, ne } from "drizzle-orm"
import { db } from "@/db"
import type { MembershipStatus } from "@/db/enums"
import { seedWorkspaceRoles } from "@/db/seed"
import {
  roles,
  team,
  user,
  workspaces,
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
 * Resolves a workspace by slug for a user. Slugs are unique per owner,
 * so an owned workspace wins; otherwise the first active membership match.
 * Returns null when the user has no access.
 */
export async function getWorkspaceBySlug(
  userId: string,
  slug: string
): Promise<WorkspaceAccess | null> {
  const owned = await db
    .select()
    .from(workspaces)
    .where(
      and(
        eq(workspaces.slug, slug),
        eq(workspaces.ownerId, userId),
        isNull(workspaces.deletedAt)
      )
    )
    .limit(1)
  if (owned[0]) {
    return { workspace: owned[0], role: "admin", isOwner: true }
  }

  const rows = await db
    .select({ workspace: workspaces, role: roles })
    .from(team)
    .innerJoin(workspaces, eq(team.workspaceId, workspaces.id))
    .innerJoin(roles, eq(team.roleId, roles.id))
    .where(
      and(
        eq(team.userId, userId),
        eq(workspaces.slug, slug),
        eq(team.status, "active"),
        isNull(workspaces.deletedAt)
      )
    )
    .limit(1)
  const row = rows[0]
  if (!row) return null
  return { workspace: row.workspace, role: row.role.title, isOwner: false }
}

export interface WorkspaceMemberItem {
  id: string
  name: string | null
  email: string | null
  image: string | null
  role: string
  status: MembershipStatus
  isOwner: boolean
}

export async function listWorkspaceMembers(
  workspaceId: string
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
  }))

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
      })
    }
  }

  return items
}
