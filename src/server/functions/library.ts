import { createServerFn } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"
import { redirect } from "@tanstack/react-router"
import { auth } from "@/lib/auth"
import { requireWorkspaceAccess } from "@/server/services/access-service"
import {
  getLibraryAsset,
  listLibraryAssets,
} from "@/server/services/library-service"
import {
  libraryAssetRefSchema,
  libraryFiltersSchema,
} from "@/lib/library-schemas"

/**
 * Thin HTTP boundary for the Library (FR-039..044). Session handling and
 * input validation live here; the workspace membership gate and the DB work
 * live in `library-service`. All reads — nothing to post, nothing to decide.
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
 * Every library call names its workspace by id and walks the one membership
 * gate `resolveMembership` owns — no library-specific shortcut, no
 * library-specific hole.
 */
async function resolveWorkspaceId(workspaceId: string): Promise<string> {
  const userId = await requireUserId()
  await requireWorkspaceAccess(workspaceId, userId)
  return userId
}

export const listLibraryFn = createServerFn({ method: "GET" })
  .validator(libraryFiltersSchema)
  .handler(async ({ data }) => {
    const userId = await resolveWorkspaceId(data.workspaceId)
    // Inside the service the same workspace id scopes every query to the
    // workspace's live projects; cross-workspace rows cannot appear.
    return listLibraryAssets(data.workspaceId, userId, data)
  })

export const getLibraryAssetFn = createServerFn({ method: "GET" })
  .validator(libraryAssetRefSchema)
  .handler(async ({ data }) => {
    const userId = await resolveWorkspaceId(data.workspaceId)
    const asset = await getLibraryAsset(data.workspaceId, userId, data.assetId)
    // Unknown id, soft-deleted project or someone else's workspace: the same
    // dead end, no detail leak.
    if (!asset) throw new Error("Asset not found.")
    return asset
  })
