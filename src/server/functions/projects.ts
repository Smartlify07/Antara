import { createServerFn } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"
import { redirect } from "@tanstack/react-router"
import { z } from "zod"
import { auth } from "@/lib/auth"
import * as projectService from "@/server/services/project-service"

/**
 * Thin HTTP boundary for project reads. Session handling and input
 * validation live here; all DB work delegates to the service layer.
 */

async function requireUserId(): Promise<string> {
  const session = await auth.api.getSession({
    headers: await getRequestHeaders(),
  })
  if (!session?.user) throw redirect({ to: "/login" })
  return session.user.id
}

export const listProjectsFn = createServerFn({ method: "GET" })
  .validator(z.object({ workspaceId: z.string() }))
  .handler(async ({ data }) => {
    const userId = await requireUserId()
    await projectService.requireWorkspaceAccess(data.workspaceId, userId)
    return projectService.listWorkspaceProjects(data.workspaceId)
  })

export const setProjectStatusFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      workspaceId: z.string(),
      projectId: z.string(),
      status: z.enum([
        "planning",
        "active",
        "on_hold",
        "completed",
        "archived",
      ]),
    })
  )
  .handler(async ({ data }) => {
    const userId = await requireUserId()
    await projectService.setProjectStatus(
      data.workspaceId,
      userId,
      data.projectId,
      data.status
    )
    return { ok: true }
  })

export const trashProjectFn = createServerFn({ method: "POST" })
  .validator(z.object({ workspaceId: z.string(), projectId: z.string() }))
  .handler(async ({ data }) => {
    const userId = await requireUserId()
    await projectService.trashProject(data.workspaceId, userId, data.projectId)
    return { ok: true }
  })
