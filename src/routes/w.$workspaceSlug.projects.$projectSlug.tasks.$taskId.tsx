import { createFileRoute } from "@tanstack/react-router"
import { TaskDetailPage } from "@/components/projects/details/task-detail-page"

export const Route = createFileRoute(
  "/w/$workspaceSlug/projects/$projectSlug/tasks/$taskId"
)({
  component: TaskDetailRoute,
})

/**
 * The task's own page (FR-016), nested under its project's layout. The route
 * reads the workspace facts from context — the same contract the request
 * detail child uses — and hands them on, so the page stays a plain
 * component like ProjectDetailPage.
 */
function TaskDetailRoute() {
  const { workspaceId } = Route.useRouteContext()
  const { workspaceSlug, projectSlug, taskId } = Route.useParams()

  return (
    <TaskDetailPage
      workspaceId={workspaceId}
      workspaceSlug={workspaceSlug}
      projectSlug={projectSlug}
      taskId={taskId}
    />
  )
}
