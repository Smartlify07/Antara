import { createServerFn } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"
import { redirect } from "@tanstack/react-router"
import { z } from "zod"
import { auth } from "@/lib/auth"
import {
  addProjectMembersSchema,
  createProjectSchema,
  projectStatusEnum,
  projectUpdateSchema,
  setProjectDatesSchema,
  setProjectDescriptionSchema,
  setProjectLeadSchema,
  setProjectTagsSchema,
  setProjectTitleSchema,
  slugifyTitle,
} from "@/lib/project-schemas"
import * as projectService from "@/server/services/project-service"
import * as projectUpdateService from "@/server/services/project-update-service"
import { captureServerEvent } from "@/server/services/analytics"

/**
 * Thin HTTP boundary for project reads. Session handling and input
 * validation live here; all DB work delegates to the service layer.
 */

async function requireUserId(): Promise<string> {
  const session = await auth.api.getSession({
    headers: await getRequestHeaders(),
  })
  if (!session?.user)
    throw redirect({ to: "/login", search: { callbackURL: undefined } })
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
      const project = await projectService.createProject(data.workspaceId, slug, {
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
      captureServerEvent({
        distinctId: userId,
        event: "project_created",
        properties: {
          workspaceId: data.workspaceId,
          title: data.title,
          slug,
        },
      })
      return project
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

export const getProjectDetailFn = createServerFn({ method: "GET" })
  .validator(z.object({ workspaceId: z.string(), projectSlug: z.string() }))
  .handler(async ({ data }) => {
    const userId = await requireUserId()
    await projectService.requireWorkspaceAccess(data.workspaceId, userId)

    const project = await projectService.getProjectBySlug(
      data.workspaceId,
      data.projectSlug
    )
    // Null rather than a throw: a stale bookmark should render a not-found
    // panel, not a 500. The caller decides how to present it.
    if (!project) return null

    const members = await projectService.listProjectMembers(
      data.workspaceId,
      project.id
    )

    return { ...project, members }
  })

export const listProjectMembersFn = createServerFn({ method: "GET" })
  .validator(z.object({ workspaceId: z.string(), projectId: z.string() }))
  .handler(async ({ data }) => {
    const userId = await requireUserId()
    await projectService.requireWorkspaceAccess(data.workspaceId, userId)
    return projectService.listProjectMembers(data.workspaceId, data.projectId)
  })

export const setProjectLeadFn = createServerFn({ method: "POST" })
  .validator(setProjectLeadSchema)
  .handler(async ({ data }) => {
    const userId = await requireUserId()
    await projectService.setProjectLead(
      data.workspaceId,
      userId,
      data.projectId,
      data.teamId
    )
    return { ok: true }
  })

export const addProjectMembersFn = createServerFn({ method: "POST" })
  .validator(addProjectMembersSchema)
  .handler(async ({ data }) => {
    const userId = await requireUserId()
    await projectService.addProjectMembers(
      data.workspaceId,
      userId,
      data.projectId,
      data.teamIds
    )
    return { ok: true }
  })

export const setProjectDatesFn = createServerFn({ method: "POST" })
  .validator(setProjectDatesSchema)
  .handler(async ({ data }) => {
    const userId = await requireUserId()
    await projectService.setProjectDates(
      data.workspaceId,
      userId,
      data.projectId,
      data.startDate,
      data.deadline
    )
    return { ok: true }
  })

export const setProjectTagsFn = createServerFn({ method: "POST" })
  .validator(setProjectTagsSchema)
  .handler(async ({ data }) => {
    const userId = await requireUserId()
    await projectService.setProjectTags(
      data.workspaceId,
      userId,
      data.projectId,
      data.tagIds,
      data.newTagLabels
    )
    return { ok: true }
  })

export const setProjectTitleFn = createServerFn({ method: "POST" })
  .validator(setProjectTitleSchema)
  .handler(async ({ data }) => {
    const userId = await requireUserId()
    await projectService.setProjectTitle(
      data.workspaceId,
      userId,
      data.projectId,
      data.title
    )
    return { ok: true }
  })

export const setProjectDescriptionFn = createServerFn({ method: "POST" })
  .validator(setProjectDescriptionSchema)
  .handler(async ({ data }) => {
    const userId = await requireUserId()
    await projectService.setProjectDescription(
      data.workspaceId,
      userId,
      data.projectId,
      data.description || null
    )
    return { ok: true }
  })

export const listProjectUpdatesFn = createServerFn({ method: "GET" })
  .validator(z.object({ workspaceId: z.string(), projectId: z.string() }))
  .handler(async ({ data }) => {
    const userId = await requireUserId()
    await projectService.requireWorkspaceAccess(data.workspaceId, userId)
    return projectUpdateService.listProjectUpdates(
      data.workspaceId,
      data.projectId
    )
  })

export const createProjectUpdateFn = createServerFn({ method: "POST" })
  .validator(projectUpdateSchema)
  .handler(async ({ data }) => {
    const userId = await requireUserId()
    // Any workspace member can post. Note this is *workspace* membership,
    // not `project_members` — posting is not yet gated on project access.
    await projectService.requireWorkspaceAccess(data.workspaceId, userId)
    return projectUpdateService.createProjectUpdate(
      data.workspaceId,
      userId,
      data.projectId,
      data.body,
      data.kind,
      data.attachments
    )
  })

export { projectStatusEnum }
