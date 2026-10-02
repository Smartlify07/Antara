import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect, useRef } from "react"
import { Loader2 } from "lucide-react"
import { readLastWorkspace } from "@/lib/last-workspace"
import { listWorkspacesFn } from "@/server/functions/workspaces"

export const Route = createFileRoute("/dashboard")({
  // listWorkspacesFn redirects to /login when there is no session.
  loader: async () => listWorkspacesFn(),
  component: DashboardRedirect,
})

/**
 * /dashboard is a router, not a page: it forwards to the last opened
 * workspace, falling back to the most recent one, and sends users with no
 * workspaces to the creation form. Navigating to /w/:slug always wins,
 * since that route renders the workspace directly.
 */
function DashboardRedirect() {
  const workspaces = Route.useLoaderData()
  const navigate = useNavigate()
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    if (workspaces.length === 0) {
      void navigate({ to: "/workspaces/new", replace: true })
      return
    }

    const last = readLastWorkspace()
    const exists = workspaces.some((item) => item.workspace.slug === last)
    const target =
      last && exists
        ? last
        : [...workspaces].sort(
            (a, b) =>
              b.workspace.createdAt.getTime() - a.workspace.createdAt.getTime()
          )[0]!.workspace.slug

    void navigate({
      to: "/w/$workspaceSlug",
      params: { workspaceSlug: target },
      replace: true,
    })
  }, [navigate, workspaces])

  return (
    <main className="flex min-h-svh items-center justify-center">
      <Loader2 className="animate-spin text-muted-foreground" />
    </main>
  )
}
