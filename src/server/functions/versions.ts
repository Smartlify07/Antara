import { createServerFn } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"
import { redirect } from "@tanstack/react-router"
import { z } from "zod"
import { auth } from "@/lib/auth"
import {
  addVersionFeedback,
  decideVersion,
  deleteDraftVersion,
  listDeliverableVersions,
  listReviewQueue,
  listVersionThread,
  reviewViewerState,
  submitForReview,
  submitVersion,
} from "@/server/services/version-service"
import { requireWorkspaceAccess } from "@/server/services/access-service"
import * as workspaceService from "@/server/services/workspace-service"
import {
  decideVersionSchema,
  deleteDraftVersionSchema,
  submitForReviewSchema,
  submitVersionSchema,
  versionFeedbackSchema,
  versionRefSchema,
} from "@/lib/version-schemas"

/**
 * Thin HTTP boundary for the version lane (FR-019..030). Session handling
 * and input validation live here; authorization and DB work live in
 * `version-service`.
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

export const listDeliverableVersionsFn = createServerFn({ method: "GET" })
  .validator(z.object({ workspaceId: z.string(), projectId: z.string(), deliverableId: z.string() }))
  .handler(async ({ data }) => {
    const userId = await resolveWorkspaceId(data.workspaceId)
    return listDeliverableVersions(data.workspaceId, userId, {
      projectId: data.projectId,
      deliverableId: data.deliverableId,
    })
  })

export const submitVersionFn = createServerFn({ method: "POST" })
  .validator(submitVersionSchema)
  .handler(async ({ data }) =>
    submitVersion(data.workspaceId, await resolveWorkspaceId(data.workspaceId), data)
  )

export const submitForReviewFn = createServerFn({ method: "POST" })
  .validator(submitForReviewSchema)
  .handler(async ({ data }) => {
    const userId = await resolveWorkspaceId(data.workspaceId)
    await submitForReview(data.workspaceId, userId, {
      projectId: data.projectId,
      versionId: data.versionId,
    })
    return { ok: true }
  })

export const decideVersionFn = createServerFn({ method: "POST" })
  .validator(decideVersionSchema)
  .handler(async ({ data }) => {
    const userId = await resolveWorkspaceId(data.workspaceId)
    await decideVersion(data.workspaceId, userId, data)
    return { ok: true }
  })

export const addVersionFeedbackFn = createServerFn({ method: "POST" })
  .validator(versionFeedbackSchema)
  .handler(async ({ data }) => {
    const userId = await resolveWorkspaceId(data.workspaceId)
    await addVersionFeedback(data.workspaceId, userId, data)
    return { ok: true }
  })

export const deleteDraftVersionFn = createServerFn({ method: "POST" })
  .validator(deleteDraftVersionSchema)
  .handler(async ({ data }) => {
    const userId = await resolveWorkspaceId(data.workspaceId)
    await deleteDraftVersion(data.workspaceId, userId, {
      projectId: data.projectId,
      versionId: data.versionId,
    })
    return { ok: true }
  })

export const listVersionThreadFn = createServerFn({ method: "GET" })
  .validator(versionRefSchema)
  .handler(async ({ data }) => {
    const userId = await resolveWorkspaceId(data.workspaceId)
    return listVersionThread(data.workspaceId, userId, {
      projectId: data.projectId,
      versionId: data.versionId,
    })
  })

export const listReviewQueueFn = createServerFn({ method: "GET" })
  .validator(z.object({ workspaceId: z.string() }))
  .handler(async ({ data }) => {
    const userId = await resolveWorkspaceId(data.workspaceId)
    return listReviewQueue(data.workspaceId, userId)
  })

/**
 * The Reviews sidebar badge + page gate: whether this viewer reviews at all,
 * and how many versions await them. Resolution and role stay server-side.
 */
export const reviewQueueBadgeFn = createServerFn({ method: "GET" })
  .validator(z.object({ workspaceSlug: z.string().min(1) }))
  .handler(async ({ data }) => {
    const userId = await requireUserId()
    const access = await workspaceService.getWorkspaceBySlug(
      userId,
      data.workspaceSlug
    )
    if (!access) return { canReview: false, count: 0 }
    return reviewViewerState(access.workspace.id, userId)
  })
