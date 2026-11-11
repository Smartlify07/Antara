import { getRequestHeaders } from "@tanstack/react-start/server"
import { redirect } from "@tanstack/react-router"
import { auth } from "@/lib/auth"
import type { WorkspaceAccess } from "@/server/services/workspace-service"
import * as workspaceService from "@/server/services/workspace-service"

/**
 * The one definition of "this caller may manage this workspace".
 *
 * Lifted out of `invites.ts` the moment a second feature needed it. A second
 * copy of a session + verified-address + admin check is a second thing to get
 * wrong, and this project has already paid for that lesson once
 * (`access-service.ts`).
 *
 * The `emailVerified` check is not incidental: an unverified session can only
 * claim an address, and managing members means acting on the addresses other
 * people hold.
 */

export interface Caller {
  userId: string
  email: string
  name: string
}

export interface WorkspaceManager {
  caller: Caller
  access: WorkspaceAccess
  isOwner: boolean
}

export async function requireWorkspaceManager(
  workspaceSlug: string
): Promise<WorkspaceManager> {
  const session = await auth.api.getSession({
    headers: await getRequestHeaders(),
  })
  if (!session?.user)
    throw redirect({ to: "/login", search: { callbackURL: undefined } })
  if (!session.user.emailVerified) {
    throw redirect({ to: "/verify-email", search: { error: undefined } })
  }

  const access = await workspaceService.getWorkspaceBySlug(
    session.user.id,
    workspaceSlug
  )
  if (!access) throw redirect({ to: "/dashboard" })

  const isAdmin = access.isOwner || access.role === "admin"
  if (!isAdmin) throw new Error("Only workspace admins can do that.")

  return {
    caller: {
      userId: session.user.id,
      email: session.user.email,
      name: session.user.name,
    },
    access,
    isOwner: access.isOwner,
  }
}
