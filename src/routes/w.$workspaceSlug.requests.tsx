import { Outlet, createFileRoute } from "@tanstack/react-router"

/**
 * Layout for every request-scoped route. The inbox lives in the index child
 * and the detail in its sibling, so both render inside the workspace shell.
 */
export const Route = createFileRoute("/w/$workspaceSlug/requests")({
  component: () => <Outlet />,
})
