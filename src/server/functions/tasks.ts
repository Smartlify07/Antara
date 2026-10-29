import { createServerFn } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"
import { redirect } from "@tanstack/react-router"
import { z } from "zod"
import { auth } from "@/lib/auth"
import {
  createTaskSchema,
  setTaskAssigneesSchema,
  setTaskDueDateSchema,
  setTaskStatusSchema,
  taskCommentSchema,
  taskIdSchema,
} from "@/lib/task-schemas"
import * as taskService from "@/server/services/task-service"
import * as workspaceService from "@/server/services/workspace-service"
import { requireWorkspaceAccess } from "@/server/services/access-service"
import { captureServerEvent } from "@/server/services/analytics"

/**
 * Thin HTTP boundary for tasks (FR-016, FR-052). The badge query is the slug
 * exception — the sidebar has only the slug — same contract as the requests
 * badge.
 */

async function requireUserId(): Promise<string> {
  const session = await auth.api.getSession({
    headers: await getRequestHeaders(),
  })
  if (!session?.user)
    throw redirect({ to: "/login", search: { callbackURL: undefined } })
  return session.user.id
}

async function resolveWorkspaceId(workspaceId: string): Promise<string> {
  const userId = await requireUserId()
  await requireWorkspaceAccess(workspaceId, userId)
  return userId
}

export const listProjectTasksFn = createServerFn({ method: "GET" })
  .validator(z.object({ workspaceId: z.string(), projectId: z.string() }))
  .handler(async ({ data }) => {
    const userId = await resolveWorkspaceId(data.workspaceId)
    return taskService.listProjectTasks(
      data.workspaceId,
      userId,
      data.projectId
    )
  })

export const createTaskFn = createServerFn({ method: "POST" })
  .validator(createTaskSchema)
  .handler(async ({ data }) => {
    const userId = await resolveWorkspaceId(data.workspaceId)
    const task = await taskService.createTask(data.workspaceId, userId, data)
    captureServerEvent({
      distinctId: userId,
      event: "task_created",
      properties: {
        workspaceId: data.workspaceId,
        projectId: data.projectId,
        title: data.title,
      },
    })
    return task
  })

export const moveTaskStatusFn = createServerFn({ method: "POST" })
  .validator(setTaskStatusSchema)
  .handler(async ({ data }) => {
    const userId = await resolveWorkspaceId(data.workspaceId)
    await taskService.moveTaskStatus(
      data.workspaceId,
      userId,
      data.projectId,
      data.taskId,
      data.status
    )
    return { ok: true }
  })

export const setTaskAssigneesFn = createServerFn({ method: "POST" })
  .validator(setTaskAssigneesSchema)
  .handler(async ({ data }) => {
    const userId = await resolveWorkspaceId(data.workspaceId)
    await taskService.setTaskAssignees(data.workspaceId, userId, data)
    return { ok: true }
  })

export const setTaskDueDateFn = createServerFn({ method: "POST" })
  .validator(setTaskDueDateSchema)
  .handler(async ({ data }) => {
    const userId = await resolveWorkspaceId(data.workspaceId)
    await taskService.setTaskDueDate(
      data.workspaceId,
      userId,
      data.projectId,
      data.taskId,
      data.dueDate
    )
    return { ok: true }
  })

/** The "My tasks" page payload, resolved through the workspace id. */
export const myTasksFn = createServerFn({ method: "GET" })
  .validator(z.object({ workspaceId: z.string() }))
  .handler(async ({ data }) => {
    const userId = await resolveWorkspaceId(data.workspaceId)
    return taskService.listMyTasks(data.workspaceId, userId)
  })

/**
 * The sidebar badge: open tasks assigned to the viewer in this workspace.
 * Zero for everyone without access — no role contract leaks, nothing but a count.
 */
export const myTasksBadgeFn = createServerFn({ method: "GET" })
  .validator(z.object({ workspaceSlug: z.string().min(1) }))
  .handler(async ({ data }) => {
    const userId = await requireUserId()
    const access = await workspaceService.getWorkspaceBySlug(
      userId,
      data.workspaceSlug
    )
    if (!access) return { count: 0 }
    return {
      count: await taskService.countMyTasks(access.workspace.id, userId),
    }
  })

/**
 * The task's own comment thread (subjectType "task"), oldest first. The task
 * page and the deliverable cabinet read through this.
 */
export const listTaskThreadFn = createServerFn({ method: "GET" })
  .validator(taskIdSchema)
  .handler(async ({ data }) => {
    const userId = await resolveWorkspaceId(data.workspaceId)
    return taskService.listTaskThread(data.workspaceId, userId, {
      projectId: data.projectId,
      taskId: data.taskId,
    })
  })

export const addTaskCommentFn = createServerFn({ method: "POST" })
  .validator(taskCommentSchema)
  .handler(async ({ data }) => {
    const userId = await resolveWorkspaceId(data.workspaceId)
    await taskService.addTaskComment(data.workspaceId, userId, data)
    return { ok: true }
  })
