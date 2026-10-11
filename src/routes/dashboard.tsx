import { createFileRoute, redirect } from "@tanstack/react-router"
import { resolveLandingFn } from "@/server/functions/workspaces"
import { pendingInvitesFn } from "@/server/functions/invites"

export const Route = createFileRoute("/dashboard")({
  // Resolves in the loader and bails out with a redirect, so this route never
  // renders a component. That matters: it used to render a spinner and
  // redirect from an effect, so every route through here — signing in, the
  // Google callback, the "already have a workspace?" link — flashed a
  // full-page loading state for a navigation that resolves immediately.
  //
  // The decision is server-side (team.last_opened_at) precisely so it can live
  // here, before render.
  loader: async () => {
    const slug = await resolveLandingFn()
    if (slug) {
      throw redirect({
        to: "/w/$workspaceSlug/projects",
        params: { workspaceSlug: slug },
      })
    }

    // No workspace of their own yet. That is the end of the road only if
    // nothing is waiting — an unaccepted invitation is the more pressing thing,
    // and sending somebody to create a workspace while one sits pending is how
    // this used to strand invitees.
    //
    // `pendingInvitesFn` also handles the unverified case by sending them to
    // `/verify-email`, which is the right destination for them regardless, and
    // can't loop: that route only forwards once the address is confirmed.
    const pending = await pendingInvitesFn()
    throw redirect(
      pending.length > 0 ? { to: "/invite/pending" } : { to: "/workspaces/new" }
    )
  },
})
