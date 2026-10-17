import { useQuery, useQueryClient } from "@tanstack/react-query"
import { SquareCheckBigIcon } from "lucide-react"
import { myTasksQuery, taskKeys } from "@/lib/queries/tasks"
import { TaskRow } from "@/components/projects/details/deliverables/task-row"

/**
 * "My tasks" (FR-052, FR-054): the viewer's open assigned work across the
 * workspace, soonest deadline first with overdue marked — the sidebar
 * placeholder turned into a real surface.
 *
 * The rows are write-enabled: being assigned a task means holding an active
 * project membership, which is exactly the server's `canWorkOnTasks` gate,
 * so the chip the viewer presses here is the same one the project's Work tab
 * offers.
 */
export function MyTasksPage({
  workspaceSlug,
  workspaceId,
}: {
  workspaceSlug: string
  workspaceId: string
}) {
  const { data, isPending } = useQuery(myTasksQuery(workspaceId))
  const queryClient = useQueryClient()
  const tasks = data?.tasks ?? []

  function refresh() {
    void queryClient.invalidateQueries({
      queryKey: taskKeys.mine(workspaceId),
    })
    void queryClient.invalidateQueries({
      queryKey: taskKeys.badge(workspaceSlug),
    })
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <SquareCheckBigIcon aria-hidden className="size-5 text-muted-foreground" />
          My tasks
        </h1>
        <p className="text-sm text-muted-foreground">
          {isPending
            ? "Loading assigned work…"
            : tasks.length === 0
              ? "Nothing open in this workspace — assigned work ends up here."
              : `${tasks.length} open ${tasks.length === 1 ? "task" : "tasks"}, soonest deadline first.`}
        </p>
      </header>

      {isPending ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((row) => (
            <div
              key={row}
              className="h-12 animate-pulse rounded-md border bg-muted/40"
            />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="text-sm font-medium">No open tasks</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Tasks assigned to you in this workspace's projects show up here
            until they are done or approved.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              workspaceSlug={workspaceSlug}
              workspaceId={workspaceId}
              task={{ ...task, deliverableLabel: task.deliverableTitle }}
              projectTitle={task.projectTitle}
              projectSlug={task.projectSlug}
              canWork
              onChanged={refresh}
            />
          ))}
        </div>
      )}
    </div>
  )
}
