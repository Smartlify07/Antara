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

/** Per-request ceiling, separate from the per-day cap. Keeps one paste bounded. */
const MAX_PER_REQUEST = 20

const createSchema = z.object({
  workspaceSlug: z.string().min(1),
  emails: z.array(z.email()).min(1).max(MAX_PER_REQUEST),
})

export interface InviteOutcome {
  email: string
  ok: boolean
  /** Stable reason code, or a message safe to show an admin. */
  code?: string
  message?: string
}

/**
 * Creates invites and sends the emails, one outcome per address.
 *
 * Results are per-recipient rather than all-or-nothing: a paste of ten
 * addresses where two are already members should still send the other eight.
 *
 * The per-address reason is safe to surface. `assertCanInvite` only ever asks
 * whether someone is in *this* workspace, which the admin can already see on
 * the member list — so this is not an oracle over the wider user base. What is
 * deliberately never returned, for any address, is whether it has an account
 * elsewhere.
 */
export const createInviteFn = createServerFn({ method: "POST" })
  .validator(createSchema)
  .handler(async ({ data }) => {
    const { caller, access, isOwner } = await requireManager(data.workspaceSlug)

    // De-duplicated case-insensitively here too. The client does the same, but
    // the server is the thing that has to be right.
    const unique = [
      ...new Map(data.emails.map((e) => [e.trim().toLowerCase(), e])).values(),
    ]

    const outcomes: InviteOutcome[] = []

    for (const raw of unique) {
      const email = normalizeEmail(raw)
      try {
        const { token, expiresAt, roleTitle } = await service.createInvite({
          workspaceId: access.workspace.id,
          email,
          // Always `member`. Granting admin isn't offered from here — a
          // promotion is a deliberate act, not a side effect of an invite.
          roleTitle: "member",
          invitedBy: caller.userId,
          isOwner,
        })

        // Fire and forget. A provider failure must not roll back a valid
        // invite, and the admin can reissue from the pending list if the mail
        // didn't go.
        void sendInviteEmail({
          to: email,
          workspaceTitle: access.workspace.title,
          inviterName: caller.name,
          roleTitle,
          token,
          expiresAt,
        })

        outcomes.push({ email, ok: true })
      } catch (e) {
        outcomes.push({
          email,
          ok: false,
          code: e instanceof service.InviteError ? e.code : "unknown",
          message:
            e instanceof service.InviteError
              ? e.message
              : "Could not send that invite.",
        })
      }
    }

    return { outcomes }
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
