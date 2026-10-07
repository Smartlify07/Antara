import { createServerFn } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"
import { redirect } from "@tanstack/react-router"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { createProjectSchema, slugifyTitle } from "@/lib/project-schemas"
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

function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: string })?.code
  if (code === "23505") return true
  const cause = (error as { cause?: { code?: string } })?.cause
  return cause?.code === "23505"
}

/**
 * Picks a slug derived from the title, appending -2, -3, ... until it is
 * free in this workspace. Project slugs are immutable, so this runs once
 * at creation.
 */
async function resolveProjectSlug(
  workspaceId: string,
  title: string
): Promise<string> {
  const base = slugifyTitle(title)
  let candidate = base

  for (let attempt = 1; attempt <= 25; attempt++) {
    const available = await projectService.isSlugAvailableInWorkspace(
      workspaceId,
      candidate
    )
    if (available) return candidate
    candidate = `${base}-${attempt + 1}`
  }

  // Fall back to something certainly unique rather than failing outright.
  return `${base}-${Date.now().toString(36)}`
}

export const createProjectFn = createServerFn({ method: "POST" })
  .validator(createProjectSchema)
  .handler(async ({ data }) => {
    const userId = await requireUserId()
    await projectService.requireWorkspaceAccess(data.workspaceId, userId)

    const slug = await resolveProjectSlug(data.workspaceId, data.title)

    try {
      return await projectService.createProject(data.workspaceId, slug, {
        title: data.title,
        description: data.description ?? null,
        status: data.status,
        startDate: data.startDate ?? null,
        deadline: data.deadline ?? null,
        memberTeamIds: data.memberIds,
        leadTeamId: data.leadId ?? null,
        tagIds: data.tagIds,
        newTagLabels: data.newTagLabels,
        ownerUserId: userId,
      })
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new Error("A project with that handle already exists.")
      }
      throw error
    }
  })

export const listAssignableMembersFn = createServerFn({ method: "GET" })
  .validator(z.object({ workspaceId: z.string() }))
  .handler(async ({ data }) => {
    const userId = await requireUserId()
    await projectService.requireWorkspaceAccess(data.workspaceId, userId)
    return projectService.listAssignableMembers(data.workspaceId)
  })

export const listProjectTagsFn = createServerFn({ method: "GET" })
  .validator(z.object({ workspaceId: z.string() }))
  .handler(async ({ data }) => {
    const userId = await requireUserId()
    await projectService.requireWorkspaceAccess(data.workspaceId, userId)
    return projectService.listWorkspaceTags(data.workspaceId)
  })

export const trashProjectFn = createServerFn({ method: "POST" })
  .validator(z.object({ workspaceId: z.string(), projectId: z.string() }))
  .handler(async ({ data }) => {
    const userId = await requireUserId()
    await projectService.trashProject(data.workspaceId, userId, data.projectId)
    return { ok: true }
  })
