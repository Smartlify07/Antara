import { createFileRoute } from "@tanstack/react-router"
import { MyTasksPage } from "@/components/tasks/my-tasks-page"

export const Route = createFileRoute("/w/$workspaceSlug/my-tasks")({
  // Set when a notification deep-links here, so the page can land with the
  // subject task in view rather than the bare list.
  validateSearch: (search: Record<string, unknown>) => ({
    task:
      typeof search.task === "string" && search.task.length > 0
        ? search.task
        : undefined,
  }),
  component: MyTasksRoute,
})

/** "My tasks" (FR-052): workspace-scoped personal work — the route context
 * supplies the workspace every personal surface sits inside. */
function MyTasksRoute() {
  const { workspaceId } = Route.useRouteContext()
  const { workspaceSlug } = Route.useParams()
  const { task } = Route.useSearch()

  return (
    <MyTasksPage
      workspaceSlug={workspaceSlug}
      workspaceId={workspaceId}
      focusTaskId={task}
    />
  )
}
