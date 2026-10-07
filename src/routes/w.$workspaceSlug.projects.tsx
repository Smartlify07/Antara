import { Outlet, createFileRoute } from "@tanstack/react-router"

/**
 * Layout for every project-scoped route. The grid itself lives in the
 * index child so `/projects/new` can render alongside it.
 */
export const Route = createFileRoute("/w/$workspaceSlug/projects")({
  component: () => <Outlet />,
})
