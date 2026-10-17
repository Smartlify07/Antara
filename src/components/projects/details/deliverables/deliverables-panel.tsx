import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2Icon, PlusIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  projectDeliverablesQuery,
  deliverableKeys,
} from "@/lib/queries/deliverables"
import { projectTasksQuery, taskKeys } from "@/lib/queries/tasks"
import { projectKeys } from "@/lib/queries/projects"
import type { AssignableMember } from "@/server/services/project-service"
import { DeliverableCard } from "./deliverable-card"
import { NewDeliverableDialog } from "./new-deliverable-dialog"
import { TaskComposer } from "./task-composer"
import { TaskRow } from "./task-row"

/**
 * The project's Work tab: deliverable cards (FR-013..017) plus the loose-
 * tasks bucket for unplaced work. The lists load in parallel; a write
 * repaints both plus the detail header's task count in one invalidation
 * turn.
 */
export function DeliverablesPanel({
  workspaceSlug,
  workspaceId,
  projectId,
  members,
}: {
  workspaceSlug: string
  workspaceId: string
  projectId: string
  /** Project members — the assignable pool for owners and task assignees. */
  members: AssignableMember[]
}) {
  const queryClient = useQueryClient()
  const deliverablesQuery = useQuery(
    projectDeliverablesQuery(workspaceId, projectId)
  )
  const tasksQuery = useQuery(projectTasksQuery(workspaceId, projectId))

  function refresh() {
    void queryClient.invalidateQueries({
      queryKey: deliverableKeys.byProject(projectId),
    })
    void queryClient.invalidateQueries({
      queryKey: taskKeys.byProject(projectId),
    })
    // The detail header's task count. Invalidation is prefix-based, so the
    // 3-wide key reaches every `detail` key for this workspace without
    // knowing which slug is on the URL.
    void queryClient.invalidateQueries({
      queryKey: projectKeys.detail(workspaceId, "").slice(0, 3),
    })
  }

  // A write fact from the server, not a guess: the tasks list's viewer says
  // who can create tasks (project member or admin), the deliverables list's
  // viewer says who can manage deliverables (project lead or admin). The
  // same access resolution stamps the per-row flags on the cards.
  const canWork = tasksQuery.data?.viewer.canWork ?? false
  const canManage = deliverablesQuery.data?.viewer.canManage ?? false

  const deliverables = deliverablesQuery.data?.deliverables ?? []
  const projectTasks = tasksQuery.data?.tasks ?? []
  const deliverableTasks = projectTasks.filter(
    (task) => task.deliverableId !== null
  )
  const looseTasks = projectTasks.filter((task) => task.deliverableId === null)

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Deliverables
          </h2>
          {canManage && (
            <NewDeliverableDialog
              workspaceId={workspaceId}
              projectId={projectId}
              members={members}
              onCreated={refresh}
            >
              <Button size="sm" variant="outline" className="h-8">
                <PlusIcon className="size-4" />
                New deliverable
              </Button>
            </NewDeliverableDialog>
          )}
        </div>

        {deliverablesQuery.isPending ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" />
            Loading deliverables…
          </p>
        ) : deliverables.length > 0 ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {deliverables.map((deliverable) => (
              <DeliverableCard
                key={deliverable.id}
                workspaceSlug={workspaceSlug}
                workspaceId={workspaceId}
                projectId={projectId}
                deliverable={deliverable}
                tasks={deliverableTasks.filter(
                  (task) => task.deliverableId === deliverable.id
                )}
                members={members}
                onChanged={refresh}
                canWork={canWork}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            {/* Honest empty state: the button above exists if and only if
                this line says the viewer can shape the work. */}
            {canManage
              ? "No deliverables yet. Break this project into its concrete pieces of work."
              : "No deliverables yet — the project lead or a workspace admin will shape the work here."}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Project tasks
          {looseTasks.length > 0 && (
            <span className="ml-2 font-normal">
              {looseTasks.length} not tied to a deliverable
            </span>
          )}
        </h2>
        {tasksQuery.isPending ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" />
            Loading tasks…
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {looseTasks.map((task) => (
              <TaskRow
                key={task.id}
                workspaceSlug={workspaceSlug}
                workspaceId={workspaceId}
                task={task}
                canWork={canWork}
                onChanged={refresh}
              />
            ))}
            {canWork && (
              <TaskComposer
                workspaceId={workspaceId}
                projectId={projectId}
                members={members}
                onCreated={refresh}
              />
            )}
            {!canWork && looseTasks.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Project members can add tasks here.
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
