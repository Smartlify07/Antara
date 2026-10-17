import { createFileRoute } from "@tanstack/react-router"
import { MyTasksPage } from "@/components/tasks/my-tasks-page"

export const Route = createFileRoute("/w/$workspaceSlug/my-tasks")({
  component: MyTasksRoute,
})

/** "My tasks" (FR-052): workspace-scoped personal work — the route context
 * supplies the workspace every personal surface sits inside. */
function MyTasksRoute() {
  const { workspaceId } = Route.useRouteContext()
  const { workspaceSlug } = Route.useParams()

  return <MyTasksPage workspaceSlug={workspaceSlug} workspaceId={workspaceId} />
}
