import { Link } from "@tanstack/react-router"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ChevronDownIcon } from "lucide-react"
import { formatDueDate } from "@/lib/time"
import { moveTaskStatusFn } from "@/server/functions/tasks"
import type { TaskStatus, TaskPriority } from "@/db/enums"
import type { TaskAssigneeRef } from "@/server/services/task-service"
import {
  TASK_PRIORITY_META,
  TASK_STATUS_META,
  taskMoveTargets,
} from "./deliverable-meta"

/**
 * The row's data contract: the project panel supplies a full `TaskCard`,
 * while "My tasks" supplies project/deliverable labels instead of assignee
 * faces — both fit structurally.
 */
export interface TaskRowData {
  id: string
  projectId: string
  deliverableId: string | null
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  dueDate: string | null
  /** Later than today and not done — stamped by the service. */
  overdue: boolean
  assignees?: TaskAssigneeRef[]
  /** The owning deliverable's name, when the row renders outside its card. */
  deliverableLabel?: string | null
}

/**
 * One task row (FR-016): status chip with the move menu (every move is legal
 * except the no-op, which the server's `assertTaskStatusMove` refuses),
 * priority, due date with the overdue mark, and assignee faces. Consumed by
 * the deliverable cards, the loose-tasks bucket and the "My tasks" page.
 */
export function TaskRow({
  workspaceSlug,
  workspaceId,
  task,
  projectTitle,
  projectSlug,
  canWork,
  onChanged,
}: {
  workspaceSlug: string
  workspaceId: string
  task: TaskRowData
  /** Shown as a chip when the row renders outside its project (My tasks). */
  projectTitle?: string
  projectSlug?: string
  canWork: boolean
  onChanged: () => void
}) {
  const status = TASK_STATUS_META[task.status]
  const priority = TASK_PRIORITY_META[task.priority]
  const targets = taskMoveTargets(task.status)

  async function move(target: (typeof targets)[number]) {
    try {
      await moveTaskStatusFn({
        data: {
          workspaceId,
          projectId: task.projectId,
          taskId: task.id,
          status: target,
        },
      })
      onChanged()
    } catch {
      // Race losers get "refresh and try again" on the next refetch, which
      // the invalidation below the write triggers — no toast scaffolding.
      onChanged()
    }
  }

  return (
    <div className="flex flex-col gap-1 rounded-md border bg-background/60 px-2.5 py-2">
      <div className="flex flex-wrap items-center gap-2">
        {canWork ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${status.badgeClass}`}
                aria-label={`Status: ${status.label}. Change status.`}
              >
                {status.label}
                <ChevronDownIcon className="size-3 opacity-70" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-36">
              {targets.map((target) => (
                <DropdownMenuItem
                  key={target}
                  onClick={() => void move(target)}
                >
                  Move to {TASK_STATUS_META[target].label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${status.badgeClass}`}
          >
            {status.label}
          </span>
        )}

        {task.priority !== "medium" && (
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${priority.badgeClass}`}
          >
            {priority.label}
          </span>
        )}

        {projectSlug ? (
          <Link
            to="/w/$workspaceSlug/projects/$projectSlug"
            params={{ workspaceSlug, projectSlug }}
            className="text-sm font-medium hover:underline"
          >
            {task.title}
          </Link>
        ) : (
          <span className="text-sm font-medium">{task.title}</span>
        )}

        {task.deliverableLabel && (
          <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] text-secondary-foreground">
            {task.deliverableLabel}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          {task.dueDate && (
            <span
              className={
                task.overdue ? "font-medium text-destructive" : undefined
              }
            >
              {task.overdue ? "Overdue · " : "due "}
              {formatDueDate(task.dueDate)}
            </span>
          )}

          {projectSlug && projectTitle && (
            <Link
              to="/w/$workspaceSlug/projects/$projectSlug"
              params={{ workspaceSlug, projectSlug }}
              className="rounded-md bg-secondary px-1.5 py-0.5 hover:underline"
            >
              {projectTitle}
            </Link>
          )}

          {(task.assignees?.length ?? 0) > 0 && (
            <span className="flex -space-x-1.5" aria-label="Assignees">
              {task.assignees?.map((assignee) => (
                <span
                  key={assignee.projectMemberId}
                  title={assignee.name ?? assignee.email ?? "Member"}
                  className="flex size-5 items-center justify-center rounded-full border bg-muted text-[10px] font-medium"
                >
                  {(assignee.name?.trim()[0] ?? "?").toUpperCase()}
                </span>
              ))}
            </span>
          )}
        </div>
      </div>

      {task.description && (
        <p className="line-clamp-1 text-xs text-muted-foreground">
          {task.description}
        </p>
      )}
    </div>
  )
}
