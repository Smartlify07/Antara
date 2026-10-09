import { resolveLandingFn } from "@/server/functions/workspaces"
import { navigateWithTransition } from "@/lib/navigate-with-transition"
import type { NavigateOptions } from "@tanstack/react-router"

/**
 * Sends someone to the workspace they should land on: the one they opened most
 * recently, or the create form if they have none.
 *
 * Used by the post-auth paths — signing in, and finishing email verification —
 * so neither has to route through /dashboard. /dashboard redirects in its
 * loader and never renders, but going there first still costs a round trip and
 * a navigation the user would perceive as a detour.
 *
 * The resolution is server-side because the preference lives there. An earlier
 * version read it from localStorage, which meant it could only be resolved
 * after a route had already painted.
 */
export async function enterApp(
  navigate: (opts: NavigateOptions) => Promise<unknown>
): Promise<void> {
  const slug = await resolveLandingFn()

  await navigateWithTransition(() =>
    slug
      ? navigate({
          to: "/w/$workspaceSlug/projects",
          params: { workspaceSlug: slug },
          replace: true,
        })
      : navigate({ to: "/workspaces/new", replace: true })
  )
}
