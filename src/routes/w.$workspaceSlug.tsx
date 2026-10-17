import {
  Outlet,
  createFileRoute,
  redirect,
  useLocation,
  useParams,
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
    const rootWithSlash = `${root}/`
    if (
      location.pathname === root ||
      location.pathname === rootWithSlash ||
      // Trailing slash on the nested projects route, e.g. /w/acme/projects/.
      // The index route serves that path, so only redirect the exact match —
      // `/w/acme/projects/<slug>/` must fall through to the detail route.
      location.pathname === `${root}/projects/`
    ) {
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
  // `strict: false` widens the param match to the whole matched route tree.
  // This layout's own params stop at `workspaceSlug`, so the project slug
  // would be invisible without it.
  const params = useParams({ strict: false })

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
    if (tail.startsWith("/requests")) return [...base, { label: "Requests" }]
    if (tail.startsWith("/my-tasks")) return [...base, { label: "My tasks" }]
    if (tail.startsWith("/projects/new")) {
      return [...base, { label: "Projects" }, { label: "New project" }]
    }
    // `/projects/<slug>`. Read with `strict: false` because the slug is a
    // param on the *child* route, which this layout's own params do not carry.
    const projectSlug = params.projectSlug
    if (projectSlug) {
      return [...base, { label: "Projects" }, { label: projectSlug }]
    }
    return [...base, { label: "Projects" }]
  }, [location.pathname, params.projectSlug, slug, title])
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
