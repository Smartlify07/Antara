import { and, asc, count, desc, eq, inArray, isNull } from "drizzle-orm"
import { db } from "@/db"
import {
  comments,
  projectMembers,
  projects,
  projectTags,
  roles,
  tags,
  tasks,
  team,
  user,
  workspaces,
} from "@/db/schema/index"
import { resolveTagColor, tagColorFor } from "@/lib/tag-colors"
import type { ProjectStatus } from "@/db/enums"

/**
 * Project domain logic. Pure DB operations only — no HTTP, no session.
 * Thin server functions in `src/server/functions` own auth and call in here.
 */

export async function requireWorkspaceAccess(
  workspaceId: string,
  userId: string
): Promise<void> {
  const [membership] = await db
    .select({ id: team.id })
    .from(team)
    .where(and(eq(team.workspaceId, workspaceId), eq(team.userId, userId)))
    .limit(1)

  if (membership) return

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

  if (!owned) {
    throw new Error("Workspace not found or you do not have access.")
  }
}

export interface ProjectListItem {
  id: string
  title: string
  slug: string
  description: string | null
  status: ProjectStatus
  startDate: Date | null
  deadline: Date | null
  createdAt: Date
  gradientStart: string | null
  gradientEnd: string | null
  taskCount: number
  memberCount: number
  commentCount: number
  tags: ProjectTagOption[]
}

/** Live projects in a workspace, soonest deadline first. */
export async function listWorkspaceProjects(
  workspaceId: string
): Promise<ProjectListItem[]> {
  const rows = await db
    .select({
      id: projects.id,
      title: projects.title,
      slug: projects.slug,
      description: projects.description,
      status: projects.status,
      startDate: projects.startDate,
      deadline: projects.deadline,
      createdAt: projects.createdAt,
      gradientStart: projects.gradientStart,
      gradientEnd: projects.gradientEnd,
    })
    .from(projects)
    .where(
      and(eq(projects.workspaceId, workspaceId), isNull(projects.deletedAt))
    )
    .orderBy(asc(projects.deadline), desc(projects.createdAt))

  if (rows.length === 0) return []

  const projectIds = rows.map((row) => row.id)

  const [taskCounts, memberCounts, commentCounts, tagRows] = await Promise.all([
    db
      .select({ projectId: tasks.projectId, total: count(tasks.id) })
      .from(tasks)
      .where(inArray(tasks.projectId, projectIds))
      .groupBy(tasks.projectId),
    db
      .select({
        projectId: projectMembers.projectId,
        total: count(projectMembers.id),
      })
      .from(projectMembers)
      .where(inArray(projectMembers.projectId, projectIds))
      .groupBy(projectMembers.projectId),
    // Comments hang off tasks, so roll them up through the task.
    db
      .select({ projectId: tasks.projectId, total: count(comments.id) })
      .from(tasks)
      .innerJoin(comments, eq(comments.taskId, tasks.id))
      .where(inArray(tasks.projectId, projectIds))
      .groupBy(tasks.projectId),
    db
      .select({
        projectId: projectTags.projectId,
        id: tags.id,
        label: tags.label,
        color: tags.color,
      })
      .from(projectTags)
      .innerJoin(tags, eq(projectTags.tagId, tags.id))
      .where(inArray(projectTags.projectId, projectIds))
      .orderBy(tags.label),
  ])

  const taskByProject = new Map(
    taskCounts.map((row) => [row.projectId, row.total])
  )
  const memberByProject = new Map(
    memberCounts.map((row) => [row.projectId, row.total])
  )
  const commentByProject = new Map(
    commentCounts.map((row) => [row.projectId, row.total])
  )
  const tagsByProject = new Map<string, ProjectTagOption[]>()
  for (const row of tagRows) {
    const list = tagsByProject.get(row.projectId) ?? []
    list.push({
      id: row.id,
      label: row.label,
      color: resolveTagColor(row.color, row.label),
    })
    tagsByProject.set(row.projectId, list)
  }

  return rows.map((row) => ({
    ...row,
    taskCount: taskByProject.get(row.id) ?? 0,
    memberCount: memberByProject.get(row.id) ?? 0,
    commentCount: commentByProject.get(row.id) ?? 0,
    tags: tagsByProject.get(row.id) ?? [],
  }))
}

/** True when no live project in this workspace already uses the slug. */
export async function isSlugAvailableInWorkspace(
  workspaceId: string,
  slug: string
): Promise<boolean> {
  const rows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(
        eq(projects.workspaceId, workspaceId),
        eq(projects.slug, slug),
        isNull(projects.deletedAt)
      )
    )
    .limit(1)

  return rows.length === 0
}

async function getProjectActionContext(
  workspaceId: string,
  userId: string
): Promise<{ role: string; isOwner: boolean }> {
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
  if (owned) return { role: "admin", isOwner: true }

  const [membership] = await db
    .select({ title: roles.title })
    .from(team)
    .innerJoin(roles, eq(team.roleId, roles.id))
    .where(
      and(
        eq(team.workspaceId, workspaceId),
        eq(team.userId, userId),
        eq(team.status, "active")
      )
    )
    .limit(1)

  if (!membership) {
    throw new Error("Workspace not found or you do not have access.")
  }
  return { role: membership.title, isOwner: false }
}

export interface AssignableMember {
  /** Membership row id in `team` — what project_members can reference. */
  teamId: string
  name: string | null
  email: string | null
  image: string | null
  /** False for invited members who have not signed up yet. */
  joined: boolean
}

/**
 * Workspace members available to add to a project, including invited
 * people who have not created an account yet.
 */
export async function listAssignableMembers(
  workspaceId: string
): Promise<AssignableMember[]> {
  const rows = await db
    .select({
      teamId: team.id,
      userId: team.userId,
      email: team.email,
      joinedAt: team.joinedAt,
      name: user.name,
      memberEmail: user.email,
      image: user.image,
    })
    .from(team)
    .leftJoin(user, eq(team.userId, user.id))
    .where(and(eq(team.workspaceId, workspaceId), eq(team.status, "active")))
    .orderBy(user.name)

  return rows.map((row) => ({
    teamId: row.teamId,
    name: row.name,
    email: row.memberEmail ?? row.email,
    image: row.image,
    joined: Boolean(row.userId) && Boolean(row.joinedAt),
  }))
}

export interface ProjectTagOption {
  id: string
  label: string
  color: string
}

/** Workspace tag vocabulary, for the tag chip. */
export async function listWorkspaceTags(
  workspaceId: string
): Promise<ProjectTagOption[]> {
  const rows = await db
    .select({ id: tags.id, label: tags.label, color: tags.color })
    .from(tags)
    .where(eq(tags.workspaceId, workspaceId))
    .orderBy(tags.label)

  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    color: resolveTagColor(row.color, row.label),
  }))
}

/** Resolves a workspace tag by label, case-insensitively. */
async function findTagByLabel(workspaceId: string, label: string) {
  const rows = await db
    .select()
    .from(tags)
    .where(eq(tags.workspaceId, workspaceId))
    .limit(200)

  const target = label.trim().toLowerCase()
  return rows.find((row) => row.label.trim().toLowerCase() === target) ?? null
}

export interface CreateProjectInput {
  title: string
  description?: string | null
  status: ProjectStatus
  startDate?: Date | null
  deadline?: Date | null
  memberTeamIds: string[]
  leadTeamId: string | null
  tagIds: string[]
  newTagLabels: string[]
  ownerUserId: string
}

export async function createProject(
  workspaceId: string,
  slug: string,
  input: CreateProjectInput
) {
  return db.transaction(async (tx) => {
    const [project] = await tx
      .insert(projects)
      .values({
        workspaceId,
        slug,
        title: input.title,
        description: input.description || null,
        status: input.status,
        startDate: input.startDate ?? null,
        deadline: input.deadline ?? null,
        createdBy: input.ownerUserId,
      })
      .returning()

    if (!project) throw new Error("Failed to create project.")

    // Project-scope roles, seeded per workspace. Workspaces created before
    // the project-scope `member` role existed are backfilled here rather
    // than failing the whole creation.
    const projectRoles = await tx
      .select()
      .from(roles)
      .where(
        and(eq(roles.workspaceId, workspaceId), eq(roles.scope, "project"))
      )

    async function ensureProjectRole(title: string) {
      const found = projectRoles.find((role) => role.title === title)
      if (found) return found
      const [created] = await tx
        .insert(roles)
        .values({ workspaceId, scope: "project", title, isSystem: true })
        .returning()
      return created
    }

    const leadRole = await ensureProjectRole("lead")
    const memberRole = await ensureProjectRole("member")

    if (!leadRole || !memberRole) {
      throw new Error("Workspace is missing its project roles.")
    }

    // Resolve the workspace user behind each picked team row so the
    // project membership links to a real user where one exists.
    const teamIds = [...new Set(input.memberTeamIds)]
    if (input.leadTeamId && !teamIds.includes(input.leadTeamId)) {
      teamIds.push(input.leadTeamId)
    }
    if (input.ownerUserId) {
      const [ownerRow] = await tx
        .select({ id: team.id })
        .from(team)
        .where(
          and(
            eq(team.workspaceId, workspaceId),
            eq(team.userId, input.ownerUserId),
            eq(team.status, "active")
          )
        )
        .limit(1)
      if (ownerRow && !teamIds.includes(ownerRow.id)) {
        teamIds.push(ownerRow.id)
      }
    }

    if (teamIds.length > 0) {
      const sourceRows = await tx
        .select({ id: team.id, userId: team.userId, email: team.email })
        .from(team)
        .where(
          and(
            eq(team.workspaceId, workspaceId),
            eq(team.status, "active"),
            inArray(team.id, teamIds)
          )
        )

      const values = sourceRows.map((row) => {
        const isLead = row.id === input.leadTeamId
        return {
          projectId: project.id,
          userId: row.userId,
          email: row.userId ? null : row.email,
          roleId: isLead ? leadRole.id : memberRole.id,
          status: "active" as const,
          addedBy: input.ownerUserId,
        }
      })

      if (values.length > 0) {
        await tx.insert(projectMembers).values(values)
      }
    }

    // Tags: reuse by id, create any new labels in the workspace vocabulary.
    const tagIds = new Set(input.tagIds)
    for (const label of input.newTagLabels) {
      const existing = await findTagByLabel(workspaceId, label)
      if (existing) {
        tagIds.add(existing.id)
        continue
      }
      const [created] = await tx
        .insert(tags)
        .values({ workspaceId, label: label.trim(), color: tagColorFor(label) })
        .onConflictDoNothing()
        .returning()
      if (created) tagIds.add(created.id)
    }

    if (tagIds.size > 0) {
      const validTags = await tx
        .select({ id: tags.id })
        .from(tags)
        .where(
          and(eq(tags.workspaceId, workspaceId), inArray(tags.id, [...tagIds]))
        )
      await tx
        .insert(projectTags)
        .values(
          validTags.map((tag) => ({ projectId: project.id, tagId: tag.id }))
        )
        .onConflictDoNothing()
    }

    return project
  })
}

export async function setProjectStatus(
  workspaceId: string,
  userId: string,
  projectId: string,
  status: ProjectStatus
): Promise<void> {
  const access = await getProjectActionContext(workspaceId, userId)
  if (!access.isOwner && access.role !== "admin") {
    throw new Error("Only workspace admins can change project status.")
  }

  const updated = await db
    .update(projects)
    .set({ status, updatedAt: new Date() })
    .where(
      and(
        eq(projects.id, projectId),
        eq(projects.workspaceId, workspaceId),
        isNull(projects.deletedAt)
      )
    )
    .returning({ id: projects.id })

  if (updated.length === 0) throw new Error("Project not found.")
}

export async function trashProject(
  workspaceId: string,
  userId: string,
  projectId: string
): Promise<void> {
  const access = await getProjectActionContext(workspaceId, userId)
  if (!access.isOwner && access.role !== "admin") {
    throw new Error("Only workspace admins can delete projects.")
  }

  const updated = await db
    .update(projects)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(projects.id, projectId),
        eq(projects.workspaceId, workspaceId),
        isNull(projects.deletedAt)
      )
    )
    .returning({ id: projects.id })

  if (updated.length === 0) throw new Error("Project not found.")
}
