import { createServerFn } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"
import { redirect } from "@tanstack/react-router"
import { z } from "zod"
import { auth } from "@/lib/auth"
import {
  createDeliverableSchema,
  deliverableCommentSchema,
  deliverableIdSchema,
  setDeliverableDeadlineSchema,
  setDeliverableOwnerSchema,
  setDeliverableStatusSchema,
} from "@/lib/deliverable-schemas"
import * as deliverableService from "@/server/services/deliverable-service"
import { requireWorkspaceAccess } from "@/server/services/access-service"

/**
 * Thin HTTP boundary for deliverables (FR-013..015, 017). Session handling
 * and input validation live here; all DB work delegates to the service layer.
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

export const listProjectDeliverablesFn = createServerFn({ method: "GET" })
  .validator(z.object({ workspaceId: z.string(), projectId: z.string() }))
  .handler(async ({ data }) => {
    const userId = await resolveWorkspaceId(data.workspaceId)
    return deliverableService.listProjectDeliverables(
      data.workspaceId,
      userId,
      data.projectId
    )
  })

export const createDeliverableFn = createServerFn({ method: "POST" })
  .validator(createDeliverableSchema)
  .handler(async ({ data }) => {
    const userId = await resolveWorkspaceId(data.workspaceId)
    return deliverableService.createDeliverable(data.workspaceId, userId, {
      workspaceId: data.workspaceId,
      projectId: data.projectId,
      title: data.title,
      description: data.description,
      type: data.type,
      ownerId: data.ownerId,
      deadline: data.deadline,
    })
  })

export const setDeliverableOwnerFn = createServerFn({ method: "POST" })
  .validator(setDeliverableOwnerSchema)
  .handler(async ({ data }) => {
    const userId = await resolveWorkspaceId(data.workspaceId)
    await deliverableService.setDeliverableOwner(data.workspaceId, userId, data)
    return { ok: true }
  })

export const setDeliverableDeadlineFn = createServerFn({ method: "POST" })
  .validator(setDeliverableDeadlineSchema)
  .handler(async ({ data }) => {
    const userId = await resolveWorkspaceId(data.workspaceId)
    await deliverableService.setDeliverableDeadline(
      data.workspaceId,
      userId,
      data
    )
    return { ok: true }
  })

export const setDeliverableStatusFn = createServerFn({ method: "POST" })
  .validator(setDeliverableStatusSchema)
  .handler(async ({ data }) => {
    const userId = await resolveWorkspaceId(data.workspaceId)
    await deliverableService.setDeliverableStatus(
      data.workspaceId,
      userId,
      data
    )
    return { ok: true }
  })

export const listDeliverableThreadFn = createServerFn({ method: "GET" })
  .validator(deliverableIdSchema)
  .handler(async ({ data }) => {
    const userId = await resolveWorkspaceId(data.workspaceId)
    return deliverableService.listDeliverableThread(data.workspaceId, userId, {
      projectId: data.projectId,
      deliverableId: data.deliverableId,
    })
  })

export const addDeliverableCommentFn = createServerFn({ method: "POST" })
  .validator(deliverableCommentSchema)
  .handler(async ({ data }) => {
    const userId = await resolveWorkspaceId(data.workspaceId)
    await deliverableService.addDeliverableComment(
      data.workspaceId,
      userId,
      data
    )
    return { ok: true }
  })
