import { createFileRoute } from "@tanstack/react-router"
import { landingLadder } from "@/server/functions/workspaces"

export const Route = createFileRoute("/dashboard")({
  // Resolves in the loader and bails out with a redirect, so this route never
  // renders a component. That matters: it used to render a spinner and
  // redirect from an effect, so every route through here — signing in, the
  // Google callback, the "already have a workspace?" link — flashed a
  // full-page loading state for a navigation that resolves immediately.
  //
  // The decision is server-side (team.last_opened_at) precisely so it can live
  // here, before render. The ladder itself lives on `landingLadder` because
  // bare /w now walks it too, and a second copy here could drift out of step.
  loader: async () => {
    await landingLadder()
  },
})
