import { Outlet, createFileRoute } from "@tanstack/react-router"

/**
 * Layout for every project-scoped route. The project detail lives in the
 * index child — the same URL this route used to serve before it grew a
 * layout — and the task detail page is its nested child, so both render
 * inside the workspace shell.
 */
export const Route = createFileRoute("/w/$workspaceSlug/projects/$projectSlug")(
  {
    component: () => <Outlet />,
  }
)
