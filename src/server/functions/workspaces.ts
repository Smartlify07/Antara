import { createServerFn } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"
import { redirect } from "@tanstack/react-router"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { workspaceSchema } from "@/lib/workspace-schemas"
import { pendingInvitesFn } from "@/server/functions/invites"
import * as service from "@/server/services/workspace-service"

/**
 * Thin HTTP boundary for workspaces. Session handling and input
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

function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: string })?.code
  if (code === "23505") return true
  const cause = (error as { cause?: { code?: string } })?.cause
  return cause?.code === "23505"
}

export const checkSlugFn = createServerFn({ method: "GET" })
  .validator(z.object({ slug: z.string() }))
  .handler(async ({ data }) => {
    const userId = await requireUserId()
    return service.isSlugAvailable(userId, data.slug)
  })

export const createWorkspaceFn = createServerFn({ method: "POST" })
  .validator(workspaceSchema)
  .handler(async ({ data }) => {
    const userId = await requireUserId()
    try {
      return await service.createWorkspace({
        name: data.name,
        slug: data.slug,
        avatarUrl: data.avatarUrl ?? null,
        ownerId: userId,
      })
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new Error("That handle is already taken. Try another.")
      }
      throw error
    }
  })

export const listWorkspacesFn = createServerFn({ method: "GET" }).handler(
  async () => service.listWorkspaces(await requireUserId())
)

/**
 * Answers "should this visitor be somewhere other than the auth pages?"
 *
 * Returns null when there is no session — the caller renders as normal.
 * Otherwise it returns enough for a `beforeLoad` to redirect: the workspace
 * to go to, and whether the address is confirmed.
 *
 * Deliberately doesn't throw on a missing session the way `requireUserId`
 * does. The authenticated routes need to tell "signed out, stay put" apart
 * from "signed in, go elsewhere", and that distinction is the whole point.
 */
export const authLandingFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const session = await auth.api.getSession({
      headers: await getRequestHeaders(),
    })
    if (!session?.user) return null
    const slug = await service.resolveLandingWorkspace(session.user.id)
    return { slug, emailVerified: session.user.emailVerified }
  }
)

/**
 * The redirect an auth route's `beforeLoad` throws once it knows a visitor
 * belongs in the app rather than on the auth pages.
 */
export function landingRedirect(slug: string | null) {
  return slug
    ? {
        to: "/w/$workspaceSlug/projects" as const,
        params: { workspaceSlug: slug },
      }
    : { to: "/workspaces/new" as const }
}

/**
 * Which workspace this person should land on, or null if they have none.
 * Consumed by /dashboard's loader and by the post-auth redirects, so it must
 * be cheap and session-gated like the rest.
 */
export const resolveLandingFn = createServerFn({ method: "GET" }).handler(
  async () => service.resolveLandingWorkspace(await requireUserId())
)

/**
 * The landing ladder, thrown as a redirect from its first sure answer. Both
 * /dashboard's loader and bare /w's `beforeLoad` run this exact sequence, so
 * it lives here once and they both call it — typed `never` because every
 * branch ends in a `throw`, so the promise never resolves to a value.
 *
 * The order is the point, and keeping it in one place is how the two routes
 * stay in lockstep:
 *
 * 1. The workspace they opened most recently. A signed-out caller never gets
 *    past the session check inside `resolveLandingFn`, which redirects to
 *    /login — the ladder inherits that gate for free.
 * 2. Otherwise a pending invitation. No workspace of their own is the end of
 *    the road only if nothing is waiting — an unaccepted invitation is the
 *    more pressing thing, and sending somebody to create a workspace while
 *    one sits pending is how this used to strand invitees. `pendingInvitesFn`
 *    also handles the unverified case by sending them to `/verify-email`,
 *    which is the right destination for them regardless, and can't loop:
 *    that route only forwards once the address is confirmed.
 * 3. Otherwise the create-workspace form.
 *
 * Two server calls at most, the same cost a /dashboard visit has always paid.
 */
export async function landingLadder(): Promise<never> {
  const slug = await resolveLandingFn()
  if (slug) {
    throw redirect({
      to: "/w/$workspaceSlug/projects",
      params: { workspaceSlug: slug },
    })
  }

  const pending = await pendingInvitesFn()
  throw redirect(
    pending.length > 0 ? { to: "/invite/pending" } : { to: "/workspaces/new" }
  )
}

/**
 * Records a visit. Fire-and-forget from the client, so it returns nothing the
 * caller needs to render.
 */
export const touchWorkspaceFn = createServerFn({ method: "POST" })
  .validator(z.object({ slug: z.string() }))
  .handler(async ({ data }) => {
    const userId = await requireUserId()
    const access = await service.getWorkspaceBySlug(userId, data.slug)
    // Unknown or inaccessible slug: nothing to record, and not an error the
    // caller acts on. Resolving it first means a bogus slug can't write.
    if (!access) return
    await service.touchWorkspace(userId, access.workspace.id)
  })

export const getWorkspaceFn = createServerFn({ method: "GET" })
  .validator(z.object({ slug: z.string() }))
  .handler(async ({ data }) => {
    const access = await service.getWorkspaceBySlug(
      await requireUserId(),
      data.slug
    )
    if (!access) throw redirect({ to: "/dashboard" })
    return access
  })

/**
 * Member count for the sidebar badge, resolved from a slug.
 *
 * Two calls in one round trip: the sidebar only needs a number, and resolving
 * slug → id then counting was previously two sequential requests on every
 * workspace navigation.
 *
 * Counts exactly what `listWorkspaceMembers` returns, pending invitees included,
 * so the badge agrees with the roster on the team page.
 */
export const workspaceTeamCountFn = createServerFn({ method: "GET" })
  .validator(z.object({ workspaceSlug: z.string().min(1) }))
  .handler(async ({ data }) => {
    const userId = await requireUserId()
    const access = await service.getWorkspaceBySlug(userId, data.workspaceSlug)
    if (!access) return 0
    const members = await service.listWorkspaceMembers(access.workspace.id)
    return members.length
  })

export const listWorkspaceMembersFn = createServerFn({ method: "GET" })
  .validator(z.object({ workspaceId: z.string() }))
  .handler(async ({ data }) => {
    const userId = await requireUserId()
    const workspaces = await service.listWorkspaces(userId)
    const access = workspaces.find(
      (item) => item.workspace.id === data.workspaceId
    )
    if (!access) throw redirect({ to: "/dashboard" })

    // Inviter names ride along only for callers who may manage the workspace.
    // Omitted entirely otherwise, rather than sent and hidden in the UI —
    // "invited by" is reconnaissance about who works with whom.
    const canManage = access.isOwner || access.role === "admin"
    return service.listWorkspaceMembers(data.workspaceId, canManage)
  })
