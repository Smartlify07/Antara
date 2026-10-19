import { createServerFn } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"
import { redirect } from "@tanstack/react-router"
import { z } from "zod"
import { auth } from "@/lib/auth"
import {
  acceptRequestSchema,
  requestMessageSchema,
  requestIdSchema,
  submitRequestSchema,
} from "@/lib/request-schemas"
import * as requestService from "@/server/services/request-service"
import { canTriage } from "@/server/services/request-permissions"
import * as workspaceService from "@/server/services/workspace-service"

/**
 * Thin HTTP boundary for the Requests module. Session handling and input
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

/**
 * Every workspace-scoped request call names its workspace by id; the badge
 * query is the exception (the sidebar has only the slug). Resolving through
 * `requireWorkspaceAccess` walks the one membership gate the rest of the app
 * uses — no request-specific shortcut, no request-specific hole.
 */
async function resolveWorkspaceId(workspaceId: string): Promise<string> {
  const userId = await requireUserId()
  await requestService.requireWorkspaceAccess(workspaceId, userId)
  return userId
}

export const listRequestsFn = createServerFn({ method: "GET" })
  .validator(z.object({ workspaceId: z.string() }))
  .handler(async ({ data }) => {
    await resolveWorkspaceId(data.workspaceId)
    return requestService.listRequests(data.workspaceId)
  })

export const getRequestFn = createServerFn({ method: "GET" })
  .validator(
    z.object({ workspaceId: z.string(), requestId: z.string().min(1) })
  )
  .handler(async ({ data }) => {
    await resolveWorkspaceId(data.workspaceId)
    const request = await requestService.getRequest(
      data.workspaceId,
      data.requestId
    )
    // Unknown id or someone else's workspace: same dead end, no detail leak.
    if (!request) throw new Error("Request not found.")
    return request
  })

export const requestThreadFn = createServerFn({ method: "GET" })
  .validator(requestIdSchema)
  .handler(async ({ data }) => {
    await resolveWorkspaceId(data.workspaceId)
    return requestService.listRequestThread(data.workspaceId, data.requestId)
  })

export const submitRequestFn = createServerFn({ method: "POST" })
  .validator(submitRequestSchema)
  .handler(async ({ data }) => {
    const userId = await resolveWorkspaceId(data.workspaceId)
    const id = await requestService.createRequest(data.workspaceId, userId, {
      title: data.title,
      brief: data.brief,
      category: data.category,
      priority: data.priority,
      desiredDeadline: data.desiredDeadline,
      referenceLinks: data.referenceLinks,
    })
    return { id }
  })

export const listRequestCategoriesFn = createServerFn({ method: "GET" })
  .validator(z.object({ workspaceId: z.string() }))
  .handler(async ({ data }) => {
    await resolveWorkspaceId(data.workspaceId)
    return requestService.listRequestCategories(data.workspaceId)
  })

export const requestThreadPostFn = createServerFn({ method: "POST" })
  .validator(requestMessageSchema)
  .handler(async ({ data }) => {
    const userId = await resolveWorkspaceId(data.workspaceId)
    await requestService.addRequestMessage(
      data.workspaceId,
      userId,
      data.requestId,
      data.body
    )
    return { ok: true }
  })

export const acceptRequestFn = createServerFn({ method: "POST" })
  .validator(acceptRequestSchema)
  .handler(async ({ data }) => {
    const userId = await resolveWorkspaceId(data.workspaceId)
    const destination = data.projectId
      ? { projectId: data.projectId }
      : data.newProjectTitle
        ? {
            newProjectTitle: data.newProjectTitle,
            newProjectDescription: data.newProjectDescription,
          }
        : null
    if (!destination) {
      throw new Error("Pick an existing project or name a new one.")
    }
    return requestService.acceptRequest(
      data.workspaceId,
      userId,
      data.requestId,
      destination,
      data.note
    )
  })

export const requestNeedsInfoFn = createServerFn({ method: "POST" })
  .validator(
    requestIdSchema.extend({
      workspaceId: z.string(),
      message: z.string().min(1),
    })
  )
  .handler(async ({ data }) => {
    const userId = await resolveWorkspaceId(data.workspaceId)
    return requestService.requestNeedsInfo(
      data.workspaceId,
      userId,
      data.requestId,
      data.message
    )
  })

export const declineRequestFn = createServerFn({ method: "POST" })
  .validator(
    requestIdSchema.extend({
      workspaceId: z.string(),
      note: z.string().max(2000).optional(),
    })
  )
  .handler(async ({ data }) => {
    const userId = await resolveWorkspaceId(data.workspaceId)
    return requestService.declineRequest(
      data.workspaceId,
      userId,
      data.requestId,
      data.note
    )
  })

/**
 * The sidebar badge: how many requests are still in the queue, and whether
 * this person may act on them. The badge renders only for triagers, and the
 * role decision stays server-side — the client never learns a role contract
 * it could fudge.
 */
export const requestBadgeFn = createServerFn({ method: "GET" })
  .validator(z.object({ workspaceSlug: z.string().min(1) }))
  .handler(async ({ data }) => {
    const userId = await requireUserId()
    const access = await workspaceService.getWorkspaceBySlug(
      userId,
      data.workspaceSlug
    )
    if (!access) return { canTriage: false, count: 0 }
    const count = await requestService.countPendingRequests(access.workspace.id)
    return { canTriage: canTriage(access), count }
  })
