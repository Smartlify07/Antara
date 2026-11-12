import { createServerFn } from "@tanstack/react-start"
import { redirect } from "@tanstack/react-router"
import { z } from "zod"
import {
  requireVerifiedSession,
  requireWorkspaceManager,
} from "@/server/functions/require-manager"
import * as workspaceService from "@/server/services/workspace-service"
import * as service from "@/server/services/member-service"

/**
 * HTTP boundary for workspace member management. The session + admin gate is
 * `requireWorkspaceManager` (shared with invites); the target guards live in
 * `member-service`; this file only validates input and maps errors.
 */

const memberSchema = z.object({
  workspaceSlug: z.string().min(1),
  /** The membership row, not the user id — a person can be in many workspaces. */
  membershipId: z.string().min(1),
})

/**
 * `MemberError` messages are authored for admins and safe to show. Anything
 * else is a database or programming failure, so its text never crosses the
 * boundary — a Drizzle error would otherwise print SQL at the user.
 */
function toPublicError(error: unknown, fallback: string): Error {
  if (error instanceof service.MemberError) return new Error(error.message)
  console.error("[members]", error)
  return new Error(fallback)
}

export const changeMemberRoleFn = createServerFn({ method: "POST" })
  .validator(
    memberSchema.extend({ roleTitle: z.string().trim().min(1).max(60) })
  )
  .handler(async ({ data }) => {
    const { caller, access } = await requireWorkspaceManager(data.workspaceSlug)

    try {
      return await service.changeMemberRole({
        workspaceId: access.workspace.id,
        membershipId: data.membershipId,
        actorUserId: caller.userId,
        roleTitle: data.roleTitle,
      })
    } catch (error) {
      throw toPublicError(error, "Could not change this member's role.")
    }
  })

export const removeMemberFn = createServerFn({ method: "POST" })
  .validator(memberSchema)
  .handler(async ({ data }) => {
    const { caller, access } = await requireWorkspaceManager(data.workspaceSlug)

    try {
      await service.removeMember({
        workspaceId: access.workspace.id,
        membershipId: data.membershipId,
        actorUserId: caller.userId,
      })
      return { ok: true as const }
    } catch (error) {
      throw toPublicError(error, "Could not remove this member.")
    }
  })

export const suspendMemberFn = createServerFn({ method: "POST" })
  .validator(memberSchema)
  .handler(async ({ data }) => {
    const { caller, access } = await requireWorkspaceManager(data.workspaceSlug)

    try {
      await service.suspendMember({
        workspaceId: access.workspace.id,
        membershipId: data.membershipId,
        actorUserId: caller.userId,
      })
      return { ok: true as const }
    } catch (error) {
      throw toPublicError(error, "Could not suspend this member.")
    }
  })

export const unsuspendMemberFn = createServerFn({ method: "POST" })
  .validator(memberSchema)
  .handler(async ({ data }) => {
    const { caller, access } = await requireWorkspaceManager(data.workspaceSlug)

    try {
      await service.unsuspendMember({
        workspaceId: access.workspace.id,
        membershipId: data.membershipId,
        actorUserId: caller.userId,
      })
      return { ok: true as const }
    } catch (error) {
      throw toPublicError(error, "Could not unsuspend this member.")
    }
  })

/**
 * Leaving is a self-action, so it needs a verified session and nothing more —
 * `requireWorkspaceManager` would make the owner an exception to their own exit
 * and block members from the one action they can take without an admin.
 *
 * Returns where the caller should land next, resolved after the write: the
 * client should not have to guess whether they have another workspace.
 */
export const leaveWorkspaceFn = createServerFn({ method: "POST" })
  .validator(z.object({ workspaceSlug: z.string().min(1) }))
  .handler(async ({ data }) => {
    const session = await requireVerifiedSession()
    const access = await workspaceService.getWorkspaceBySlug(
      session.user.id,
      data.workspaceSlug
    )
    if (!access) throw redirect({ to: "/dashboard" })

    try {
      await service.leaveWorkspace({
        workspaceId: access.workspace.id,
        actorUserId: session.user.id,
      })
      return {
        landingSlug: await workspaceService.resolveLandingWorkspace(
          session.user.id
        ),
      }
    } catch (error) {
      throw toPublicError(error, "Could not leave this workspace.")
    }
  })
