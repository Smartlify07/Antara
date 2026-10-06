import {
  Outlet,
  createFileRoute,
  redirect,
  useLocation,
} from "@tanstack/react-router"
import { useMemo } from "react"
import { AppShell, type Crumb } from "@/components/app-shell"
import { getWorkspaceFn } from "@/server/functions/workspaces"

/**
 * Layout for every workspace-scoped route. Owns the access check and the
 * shell chrome; children render through the Outlet.
 */
export const Route = createFileRoute("/w/$workspaceSlug")({
  beforeLoad: async ({ params, location }) => {
    const access = await getWorkspaceFn({
      data: { slug: params.workspaceSlug },
    })

    // The workspace root has no page of its own; projects is the landing.
    // Keeps old bookmarks and stale links from dead-ending on an empty shell.
    const root = `/w/${params.workspaceSlug}`
    if (location.pathname === root || location.pathname === `${root}/`) {
      throw redirect({
        to: "/w/$workspaceSlug/projects",
        params: { workspaceSlug: params.workspaceSlug },
      })
    }

    return {
      workspace: access.workspace,
      workspaceRole: access.role,
      isWorkspaceOwner: access.isOwner,
      workspaceId: access.workspace.id,
    }
  },
  component: WorkspaceLayout,
})

function useWorkspaceCrumbs(slug: string, title: string): Crumb[] {
  const location = useLocation()

  return useMemo(() => {
    const base: Crumb[] = [
      {
        label: title,
        to: "/w/$workspaceSlug/projects",
        params: { workspaceSlug: slug },
      },
    ]
    const tail = location.pathname.slice(`/w/${slug}`.length)
    if (tail.startsWith("/team")) return [...base, { label: "Team" }]
    return [...base, { label: "Projects" }]
  }, [location.pathname, slug, title])
}

function WorkspaceLayout() {
  const { workspace } = Route.useRouteContext()
  const crumbs = useWorkspaceCrumbs(workspace.slug, workspace.title)

  return (
    <AppShell crumbs={crumbs}>
      <Outlet />
    </AppShell>
  )
}
