import { Outlet, createFileRoute } from "@tanstack/react-router"
import { parseProjectDetailSearch } from "@/lib/project-detail-search"

/**
 * Layout for every project-scoped route. The project detail lives in the
 * index child — the same URL this route used to serve before it grew a
 * layout — and the task detail page is its nested child, so both render
 * inside the workspace shell.
 *
 * The search params are validated here rather than on the index child, so a
 * notification's `?tab=work&deliverable=…&version=…` link has one declared
 * schema at the entry every link can target.
 */
export const Route = createFileRoute("/w/$workspaceSlug/projects/$projectSlug")(
  {
    validateSearch: (search: Record<string, unknown>) =>
      parseProjectDetailSearch(search),
    component: () => <Outlet />,
  }
)
