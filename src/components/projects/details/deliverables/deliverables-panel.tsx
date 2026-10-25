import { useQuery, useQueryClient } from "@tanstack/react-query"
import { PlusIcon } from "lucide-react"
import { AppLoading } from "@/components/app-loading"
import { Button } from "@/components/ui/button"
import {
  deliverableKeys,
  projectDeliverablesQuery,
} from "@/lib/queries/deliverables"
import { projectTasksQuery, taskKeys } from "@/lib/queries/tasks"
import { projectKeys } from "@/lib/queries/projects"
import type { AssignableMember } from "@/server/services/project-service"
import { DeliverablesCabinet } from "./deliverables-cabinet"
import { NewDeliverableDialog } from "./new-deliverable-dialog"

/**
 * The project's Work tab. The deliverables side is the folder cutout: the
 * pocket opens the cabinet dialog, where each deliverable is a two-pane
 * thread — its tasks, its own conversation, and its version timeline pulled
 * up one level (`deliverables-cabinet.tsx`, geometry from the Variant C
 * concept). Tasks are deliverable-bound only: the loose task bucket is gone,
 * so work has a home per piece of the project.
 *
 * Both lists load in parallel; a write repaints every list plus the detail
 * header's task count in one invalidation turn.
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

  // One arrival: the Work tab paints only when both lists have landed, then
  // it paints whole — no per-list "Loading…" lines flickering into pieces.
  if (deliverablesQuery.isPending || tasksQuery.isPending) {
    return <AppLoading />
  }

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
  // same access resolution stamps the per-row flags the cabinet re-checks.
  const canWork = tasksQuery.data?.viewer.canWork ?? false
  const canManage = deliverablesQuery.data?.viewer.canManage ?? false

  const deliverables = deliverablesQuery.data?.deliverables ?? []
  const projectTasks = tasksQuery.data?.tasks ?? []

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

        <div className="flex flex-col gap-2">
          <DeliverablesCabinet
            workspaceId={workspaceId}
            projectId={projectId}
            workspaceSlug={workspaceSlug}
            deliverables={deliverables}
            tasks={projectTasks}
            tasksViewer={{ canWork }}
            deliverablesViewer={{ canManage }}
            members={members}
            onChanged={refresh}
          />
          {deliverables.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {/* Honest empty state next to the sleeping pocket: the New
                  deliverable button above exists if and only if this line
                  says the viewer can shape the work. */}
              {canManage
                ? "No deliverables yet. Break this project into its concrete pieces of work."
                : "No deliverables yet — the project lead or a workspace admin will shape the work here."}
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
