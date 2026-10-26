import { createFileRoute } from "@tanstack/react-router"
import { landingLadder } from "@/server/functions/workspaces"

/**
 * The /w layout: a transparent pass-through over every workspace route.
 *
 * It exists for the bare URL. Typing `/w` with no slug matched nothing and
 * dead-ended on the 404, yet it asks the same question /dashboard answers —
 * "take me where I was" — so it runs the identical ladder in `beforeLoad`
 * and costs exactly what a /dashboard visit costs.
 *
 * Everything else about it is deliberately inert. No component and no loader:
 * the workspace layout below already owns the access check and the shell
 * chrome, and this layer must add nothing to nested navigations. That is why
 * the guard acts only when the pathname is the bare root — exactly `/w` or
 * `/w/`, the two spellings a trailing slash arrives as — while `/w/acme`
 * and everything beneath it passes through untouched.
 */
export const Route = createFileRoute("/w")({
  beforeLoad: async ({ location }) => {
    if (location.pathname === "/w" || location.pathname === "/w/") {
      await landingLadder()
    }
  },
})
