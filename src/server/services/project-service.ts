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
  workspaces,
} from "@/db/schema/index"
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
  deadline: Date | null
  createdAt: Date
  gradientStart: string | null
  gradientEnd: string | null
  taskCount: number
  memberCount: number
  commentCount: number
  tags: { id: string; label: string }[]
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
  const tagsByProject = new Map<string, { id: string; label: string }[]>()
  for (const row of tagRows) {
    const list = tagsByProject.get(row.projectId) ?? []
    list.push({ id: row.id, label: row.label })
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
