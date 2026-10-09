import { createServerFn } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"
import { redirect } from "@tanstack/react-router"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { sendInviteEmail } from "@/lib/email/templates"
import { normalizeEmail } from "@/lib/normalize-email"
import * as service from "@/server/services/invite-service"
import * as inviteService from "@/server/services/invite-service"
import * as workspaceService from "@/server/services/workspace-service"
import { INVITE_TTL_DAYS } from "@/lib/invite-token"

/**
 * HTTP boundary for workspace invites. Session handling and authorisation
 * live here; all DB work delegates to the service layer.
 */

interface Caller {
  userId: string
  email: string
  name: string
}

/**
 * The session, and whether the caller may manage this workspace.
 *
 * Throws a redirect when there is no session, so an unauthenticated caller
 * never reaches the service at all.
 *
 * Note the `emailVerified` check. It is not incidental: `requireEmailVerification`
 * means an unverified account cannot normally sign in, but the session is the
 * only thing that proves the caller owns the address an invite is being sent
 * to. Acting on an unverified session would let someone who merely *claimed*
 * an address invite people into it.
 */
async function requireManager(workspaceSlug: string) {
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
    } satisfies Caller,
    access,
    isAdmin,
    isOwner: access.isOwner,
  }
}

const createSchema = z.object({
  workspaceSlug: z.string().min(1),
  email: z.email(),
  roleTitle: z.enum(["admin", "member"]),
})

/**
 * Creates an invite and sends the email.
 *
 * The response never varies with whether the address already has an account.
 * That question is answered inside the workspace by `assertCanInvite`; asking
 * it globally would hand any admin a way to enumerate the product.
 */
export const createInviteFn = createServerFn({ method: "POST" })
  .validator(createSchema)
  .handler(async ({ data }) => {
    const { caller, access, isOwner } = await requireManager(data.workspaceSlug)

    const email = normalizeEmail(data.email)

    try {
      const { token, expiresAt, roleTitle } = await service.createInvite({
        workspaceId: access.workspace.id,
        email,
        roleTitle: data.roleTitle,
        invitedBy: caller.userId,
        isOwner,
      })

      // Fire and forget. A provider failure must not roll back a valid invite,
      // and the admin can reissue from the pending list if the mail didn't go.
      void sendInviteEmail({
        to: email,
        workspaceTitle: access.workspace.title,
        inviterName: caller.name,
        roleTitle,
        token,
        expiresAt,
      })

      return { ok: true as const }
    } catch (e) {
      if (e instanceof service.InviteError) {
        return { ok: false as const, code: e.code, message: e.message }
      }
      throw e
    }
  })

export const listPendingInvitesFn = createServerFn({ method: "GET" })
  .validator(z.object({ workspaceSlug: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { access, isAdmin } = await requireManager(data.workspaceSlug)
    // `isAdmin` decides whether inviter names come along. They are never sent
    // to a non-admin, rather than being sent and hidden in the UI.
    return service.listPendingInvites(access.workspace.id, isAdmin)
  })

export const revokeInviteFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      workspaceSlug: z.string().min(1),
      inviteId: z.string().min(1),
    })
  )
  .handler(async ({ data }) => {
    const { access } = await requireManager(data.workspaceSlug)
    await service.revokeInvite(access.workspace.id, data.inviteId)
    return { ok: true as const }
  })

/**
 * Looks up an invite for the landing page.
 *
 * Public, and deliberately uniform: a missing, expired and already-accepted
 * token all return the same shape. Differentiating them would confirm that a
 * guessed token was once real.
 */
export const inspectInviteFn = createServerFn({ method: "GET" })
  .validator(z.object({ token: z.string().min(1) }))
  .handler(async ({ data }) => {
    const invite = await service.findLiveInviteByToken(data.token)
    if (!invite) return { valid: false as const }

    const [workspace, role] = await Promise.all([
      inviteService.getWorkspaceForInvite(invite.workspaceId),
      inviteService.getRoleTitle(invite.roleId),
    ])
    if (!workspace) return { valid: false as const }

    return {
      valid: true as const,
      workspaceTitle: workspace.title,
      workspaceSlug: workspace.slug,
      roleTitle: role,
      emailHint: invite.email,
      expiresAt: invite.expiresAt,
    }
  })

/**
 * Redeems an invite.
 *
 * Requires a **verified** session — the load-bearing check for this whole
 * feature. A seat is reserved for an address that may have no account yet, so
 * registering that address succeeds; without this gate, whoever claims the
 * address first walks into the workspace. `autoSignInAfterVerification` exists
 * precisely so the happy path can still be one click.
 */
export const acceptInviteFn = createServerFn({ method: "POST" })
  .validator(z.object({ token: z.string().min(1) }))
  .handler(async ({ data }) => {
    const session = await auth.api.getSession({
      headers: await getRequestHeaders(),
    })
    if (!session?.user)
      throw redirect({ to: "/login", search: { callbackURL: undefined } })
    if (!session.user.emailVerified) {
      throw redirect({ to: "/verify-email", search: { error: undefined } })
    }

    try {
      const workspace = await service.acceptInviteForUser(
        data.token,
        session.user.id,
        session.user.email
      )
      if (!workspace) return { ok: false as const, code: "not_found" as const }
      return { ok: true as const, workspaceSlug: workspace.slug }
    } catch (e) {
      if (e instanceof service.InviteError) {
        return { ok: false as const, code: e.code }
      }
      throw e
    }
  })

/**
 * Who is asking, for the invite landing page.
 *
 * Only the two facts the page branches on. Deliberately not the user id or
 * email — the page has no use for them, and returning less is less to leak.
 */
export const inviteViewerFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const session = await auth.api.getSession({
      headers: await getRequestHeaders(),
    })
    return {
      signedIn: !!session?.user,
      emailVerified: session?.user?.emailVerified ?? false,
    }
  }
)

export { INVITE_TTL_DAYS }
