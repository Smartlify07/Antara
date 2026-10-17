import { and, asc, count, eq, inArray, isNull, ne, or, sql } from "drizzle-orm"
import { db } from "@/db"
import { user } from "@/db/schema/auth"
import { deliverables } from "@/db/schema/deliverables"
import { projectMembers, projects } from "@/db/schema/projects"
import { statusHistory, taskAssignees, tasks } from "@/db/schema/tasks"
import { team } from "@/db/schema/workspaces"
import type { TaskPriority, TaskStatus } from "@/db/enums"
import type {
  CreateTaskInput,
  SetTaskAssigneesInput,
} from "@/lib/task-schemas"
import { assertTaskStatusMove, canWorkOnTasks } from "./work-permissions"
import { requireWorkAccess } from "./work-access"

/**
 * The task service (FR-016, FR-052). Tasks hang off a project — optionally a
 * deliverable of one — and every status move lands in `status_history` with
 * the actor attached, which is the audit trail the plan asks this lane to
 * reuse instead of inventing new bookkeeping.
 *
 * Assignees reference `project_members` rows (DB-enforced "must be a project
 * member"), while the UI carries `team` ids; the mapping back is the same
 * user-id-or-lowercased-email join `listProjectMembers` uses, so the two
 * surfaces can never disagree about who the members are.
 */

/** A date-only wire value ("2026-02-01") pinned to UTC midnight. */
function parseDayDate(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) throw new Error("That date could not be read.")
  return date
}

function isoDayOrNull(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export interface TaskAssigneeRef {
  projectMemberId: string
  name: string | null
  email: string | null
  image: string | null
}

export interface TaskCard {
  id: string
  projectId: string
  deliverableId: string | null
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  /** Date-only string, or null. */
  dueDate: string | null
  /** Later than today, and the task is not done — the "requires attention" mark. */
  overdue: boolean
  assignees: TaskAssigneeRef[]
}

async function requireLiveProject(
  workspaceId: string,
  projectId: string
): Promise<void> {
  const rows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(
        eq(projects.id, projectId),
        eq(projects.workspaceId, workspaceId),
        isNull(projects.deletedAt)
      )
    )
    .limit(1)
  if (rows.length === 0) throw new Error("Project not found.")
}

/** The deliverable, when named, must belong to this same project. */
async function requireDeliverableInProject(
  workspaceId: string,
  projectId: string,
  deliverableId: string
): Promise<void> {
  const rows = await db
    .select({ id: deliverables.id })
    .from(deliverables)
    .where(
      and(
        eq(deliverables.id, deliverableId),
        eq(deliverables.projectId, projectId),
        eq(deliverables.workspaceId, workspaceId)
      )
    )
    .limit(1)
  if (rows.length === 0) {
    throw new Error("That deliverable is not part of this project.")
  }
}

/**
 * Resolves `team` ids to the project's active membership rows. A team id with
 * no matching membership means someone the project never had (or has already
 * lost) — refuse loudly rather than implant a half-assignment.
 */
async function resolveProjectMemberIds(
  projectId: string,
  workspaceId: string,
  teamIds: string[]
): Promise<string[]> {
  if (teamIds.length === 0) return []

  const rows = await db
    .select({ id: projectMembers.id })
    .from(projectMembers)
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
        inArray(team.id, teamIds)
      )
    )
    .groupBy(projectMembers.id)

  const resolved = rows.map((row) => row.id)
  if (resolved.length !== new Set(teamIds).size) {
    throw new Error("Assignees must be current project members.")
  }
  return resolved
}

/** Reads tasks with their assignees, grouped in JS (rows repeat per member). */
async function loadProjectTasks(
  workspaceId: string,
  projectId: string
): Promise<TaskCard[]> {
  const rows = await db
    .select({
      id: tasks.id,
      projectId: tasks.projectId,
      deliverableId: tasks.deliverableId,
      title: tasks.title,
      description: tasks.description,
      status: tasks.status,
      priority: tasks.priority,
      dueDate: tasks.dueDate,
      // Deterministic order backstop so grouping never shuffles cards.
      createdAt: tasks.createdAt,
      projectMemberId: taskAssignees.projectMemberId,
      assigneeName: user.name,
      assigneeEmail: user.email,
      assigneeTeamEmail: team.email,
      assigneeImage: user.image,
    })
    .from(tasks)
    .leftJoin(taskAssignees, eq(taskAssignees.taskId, tasks.id))
    .leftJoin(projectMembers, eq(projectMembers.id, taskAssignees.projectMemberId))
    .leftJoin(
      team,
      and(
        eq(team.workspaceId, workspaceId),
        or(
          eq(team.userId, projectMembers.userId),
          sql`lower(${team.email}) = lower(${projectMembers.email})`
        )
      )
    )
    .leftJoin(user, eq(team.userId, user.id))
    .where(eq(tasks.projectId, projectId))
    .orderBy(sql`${tasks.dueDate} ASC NULLS LAST`, asc(tasks.createdAt))

  const today = todayIso()
  const byId = new Map<string, TaskCard>()

  for (const row of rows) {
    let card = byId.get(row.id)
    if (!card) {
      const dueDate = isoDayOrNull(row.dueDate)
      card = {
        id: row.id,
        projectId: row.projectId,
        deliverableId: row.deliverableId,
        title: row.title,
        description: row.description,
        status: row.status,
        priority: row.priority,
        dueDate,
        overdue: dueDate !== null && dueDate < today && row.status !== "done" && row.status !== "approved",
        assignees: [],
      }
      byId.set(row.id, card)
    }
    if (row.projectMemberId) {
      // A membership can resolve through a user id AND an email match; the
      // same row twice is a display bug, so push each membership once.
      const seen = card.assignees.some(
        (assignee) => assignee.projectMemberId === row.projectMemberId
      )
      if (!seen) {
        card.assignees.push({
          projectMemberId: row.projectMemberId,
          name: row.assigneeName,
          email: row.assigneeEmail ?? row.assigneeTeamEmail,
          image: row.assigneeImage,
        })
      }
    }
  }

  return [...byId.values()]
}

export async function listProjectTasks(
  workspaceId: string,
  userId: string,
  projectId: string
): Promise<{ tasks: TaskCard[]; viewer: { canWork: boolean } }> {
  const access = await requireWorkAccess(workspaceId, userId, projectId)
  const taskRows = await loadProjectTasks(workspaceId, projectId)
  return {
    tasks: taskRows,
    viewer: { canWork: canWorkOnTasks(access.facts) },
  }
}

export async function createTask(
  workspaceId: string,
  userId: string,
  input: CreateTaskInput
): Promise<{ id: string }> {
  const access = await requireWorkAccess(workspaceId, userId, input.projectId)
  if (!canWorkOnTasks(access.facts)) {
    throw new Error("Only project members can add tasks.")
  }
  await requireLiveProject(workspaceId, input.projectId)
  if (input.deliverableId) {
    await requireDeliverableInProject(workspaceId, input.projectId, input.deliverableId)
  }
  const memberIds = await resolveProjectMemberIds(
    input.projectId,
    workspaceId,
    input.assigneeTeamIds ?? []
  )

  return db.transaction(async (tx) => {
    const createdRows = await tx
      .insert(tasks)
      .values({
        projectId: input.projectId,
        deliverableId: input.deliverableId ?? null,
        title: input.title,
        description: input.description ?? null,
        status: "backlog",
        priority: input.priority ?? "medium",
        dueDate: input.dueDate ? parseDayDate(input.dueDate) : null,
        createdBy: userId,
      })
      .returning({ id: tasks.id })
    if (createdRows.length === 0) throw new Error("Could not create the task.")

    if (memberIds.length > 0) {
      await tx.insert(taskAssignees).values(
        memberIds.map((projectMemberId) => ({
          taskId: createdRows[0].id,
          projectMemberId,
        }))
      )
    }
    return { id: createdRows[0].id }
  })
}

async function requireTask(
  workspaceId: string,
  projectId: string,
  taskId: string
): Promise<{ status: TaskStatus; projectId: string; deliverableId: string | null }> {
  const rows = await db
    .select({
      status: tasks.status,
      projectId: tasks.projectId,
      deliverableId: tasks.deliverableId,
    })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .where(
      and(
        eq(tasks.id, taskId),
        eq(tasks.projectId, projectId),
        eq(projects.workspaceId, workspaceId),
        isNull(projects.deletedAt)
      )
    )
    .limit(1)
  if (rows.length === 0) throw new Error("Task not found.")
  return rows[0]
}

/**
 * Presses a status move: guarded against no-ops, recorded in `status_history`,
 * and written race-guarded — the UPDATE carries the previous status so the
 * loser of a double-click gets the shared "refresh and try again" error.
 */
export async function moveTaskStatus(
  workspaceId: string,
  userId: string,
  projectId: string,
  taskId: string,
  to: TaskStatus
): Promise<void> {
  const access = await requireWorkAccess(workspaceId, userId, projectId)
  if (!canWorkOnTasks(access.facts)) {
    throw new Error("Only project members can move tasks.")
  }
  const current = await requireTask(workspaceId, projectId, taskId)
  assertTaskStatusMove(current.status, to)

  // Race-guarded and atomic: the UPDATE carries the previous status so the
  // loser of a double-click gets the shared "refresh and try again" error,
  // and the history row lands in the same transaction — a move whose audit
  // record failed to write is a bug, not a best-effort log.
  await db.transaction(async (tx) => {
    const moved = await tx
      .update(tasks)
      .set({ status: to, updatedAt: new Date() })
      .where(and(eq(tasks.id, taskId), eq(tasks.status, current.status)))
      .returning({ id: tasks.id })
    if (moved.length === 0) {
      throw new Error("This task was just updated — refresh and try again.")
    }

    await tx.insert(statusHistory).values({
      taskId,
      fromStatus: current.status,
      toStatus: to,
      changedBy: userId,
    })
  })
}

export async function setTaskAssignees(
  workspaceId: string,
  userId: string,
  input: SetTaskAssigneesInput
): Promise<void> {
  const access = await requireWorkAccess(workspaceId, userId, input.projectId)
  if (!canWorkOnTasks(access.facts)) {
    throw new Error("Only project members can assign tasks.")
  }
  const current = await requireTask(workspaceId, input.projectId, input.taskId)
  void current
  await requireLiveProject(workspaceId, input.projectId)
  const memberIds = await resolveProjectMemberIds(
    input.projectId,
    workspaceId,
    input.assigneeTeamIds
  )

  await db.transaction(async (tx) => {
    await tx
      .delete(taskAssignees)
      .where(eq(taskAssignees.taskId, input.taskId))
    if (memberIds.length > 0) {
      await tx.insert(taskAssignees).values(
        memberIds.map((projectMemberId) => ({
          taskId: input.taskId,
          projectMemberId,
        }))
      )
    }
  })
}

export async function setTaskDueDate(
  workspaceId: string,
  userId: string,
  projectId: string,
  taskId: string,
  dueDate: string | null
): Promise<void> {
  const access = await requireWorkAccess(workspaceId, userId, projectId)
  if (!canWorkOnTasks(access.facts)) {
    throw new Error("Only project members can change due dates.")
  }
  await requireTask(workspaceId, projectId, taskId)

  await db
    .update(tasks)
    .set({ dueDate: dueDate ? parseDayDate(dueDate) : null, updatedAt: new Date() })
    .where(eq(tasks.id, taskId))
}

export interface MyTaskItem {
  id: string
  projectId: string
  projectTitle: string
  projectSlug: string
  projectStatus: string
  deliverableId: string | null
  deliverableTitle: string | null
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  dueDate: string | null
  overdue: boolean
}

/**
 * The viewer's open assigned work across the workspace (FR-052): every task
 * one of THEIR project memberships is assigned to, not done and not yet
 * approved. A done task with outstanding siblings stays discoverable on the
 * project's Work tab; "My tasks" is the to-do column, not the archive.
 */
export async function listMyTasks(
  workspaceId: string,
  userId: string
): Promise<{ tasks: MyTaskItem[] }> {
  const today = todayIso()
  const rows = await db
    .select({
      id: tasks.id,
      projectId: tasks.projectId,
      projectTitle: projects.title,
      projectSlug: projects.slug,
      projectStatus: projects.status,
      deliverableId: deliverables.id,
      deliverableTitle: deliverables.title,
      title: tasks.title,
      description: tasks.description,
      status: tasks.status,
      priority: tasks.priority,
      dueDate: tasks.dueDate,
    })
    .from(tasks)
    .innerJoin(taskAssignees, eq(taskAssignees.taskId, tasks.id))
    .innerJoin(
      projectMembers,
      and(
        eq(projectMembers.id, taskAssignees.projectMemberId),
        eq(projectMembers.status, "active")
      )
    )
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .leftJoin(deliverables, eq(deliverables.id, tasks.deliverableId))
    .where(
      and(
        eq(projects.workspaceId, workspaceId),
        isNull(projects.deletedAt),
        ne(tasks.status, "done"),
        ne(tasks.status, "approved"),
        // Me, the way assignees can ever come to exist: my membership rows.
        or(
          eq(projectMembers.userId, userId),
          sql`${projectMembers.userId} IS NULL AND ${
            projectMembers.email
          } IN (SELECT lower(email) FROM ${user} WHERE ${user.id} = ${userId})`
        )
      )
    )
    // Overdue first, then soonest due; undated last. Priority is a tiebreaker.
    .orderBy(
      sql`${tasks.dueDate} ASC NULLS LAST`,
      sql`CASE ${tasks.priority} WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END`,
      asc(tasks.title)
    )

  return {
    tasks: rows.map((row) => {
      const dueDate = isoDayOrNull(row.dueDate)
      return {
        ...row,
        dueDate,
        overdue: dueDate !== null && dueDate < today,
      }
    }),
  }
}

/** Sidebar badge: open tasks assigned to the viewer in this workspace. */
export async function countMyTasks(
  workspaceId: string,
  userId: string
): Promise<number> {
  const rows = await db
    .select({ total: count(tasks.id) })
    .from(tasks)
    .innerJoin(taskAssignees, eq(taskAssignees.taskId, tasks.id))
    .innerJoin(
      projectMembers,
      and(
        eq(projectMembers.id, taskAssignees.projectMemberId),
        eq(projectMembers.status, "active")
      )
    )
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .where(
      and(
        eq(projects.workspaceId, workspaceId),
        isNull(projects.deletedAt),
        ne(tasks.status, "done"),
        ne(tasks.status, "approved"),
        or(
          eq(projectMembers.userId, userId),
          sql`${projectMembers.userId} IS NULL AND ${projectMembers.email} IN (SELECT lower(email) FROM ${user} WHERE ${user.id} = ${userId})`
        )
      )
    )
  return rows.length > 0 ? rows[0].total : 0
}
