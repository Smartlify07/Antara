import { Link } from "@tanstack/react-router"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ChevronDownIcon, UserPlusIcon } from "lucide-react"
import { useState } from "react"
import { Chip, ChipOption } from "@/components/projects/chip"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { formatDueDate } from "@/lib/time"
import { taskKeys } from "@/lib/queries/tasks"
import type { ProjectTasksCache } from "@/lib/queries/tasks"
import { cn } from "@/lib/utils"
import { moveTaskStatusFn, setTaskAssigneesFn } from "@/server/functions/tasks"
import type { TaskStatus, TaskPriority } from "@/db/enums"
import type { TaskAssigneeRef } from "@/server/services/task-service"
import type { AssignableMember } from "@/server/services/project-service"
import {
  TASK_DOTS,
  TASK_PRIORITY_META,
  TASK_STATUS_META,
  TASK_STATUS_ORDER,
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
 * One task row (FR-016): status pill with the state list (every move is legal
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
  members,
  canWork,
  onChanged,
}: {
  workspaceSlug: string
  workspaceId: string
  task: TaskRowData
  /** Shown as a chip when the row renders outside its project (My tasks). */
  projectTitle?: string
  projectSlug?: string
  /**
   * The project's member pool. Only the project surfaces have it — on "My
   * tasks" the row falls back to the static faces with no control.
   */
  members?: AssignableMember[]
  canWork: boolean
  onChanged: () => void
}) {
  const client = useQueryClient()
  const [assignError, setAssignError] = useState<string | null>(null)

  const status = TASK_STATUS_META[task.status]
  const priority = TASK_PRIORITY_META[task.priority]
  const targets = taskMoveTargets(task.status)

  // The create-composer writes newly created tasks into this same cache with
  // ids prefixed `optimistic-` while the server side of the round trip is
  // still running. Such a row does not exist on the server yet, so a status
  // move or an assign against that id would 404; until the settle refetch
  // swaps in the real row, both controls render their non-editable static
  // state (the assignees the placeholder carries still render normally).
  const isOptimistic = task.id.startsWith("optimistic-")
  const canMove = canWork && !isOptimistic
  const canAssign = canMove && members !== undefined

  const tasksKey = taskKeys.byProject(task.projectId)

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

  /**
   * Whole-set assigner, mirroring the server fn + TaskComposer's single
   * assignee: `[teamId]` assigns one person, `[]` clears the task.
   */
  const assign = useMutation({
    mutationFn: (assigneeTeamIds: string[]) =>
      setTaskAssigneesFn({
        data: {
          workspaceId,
          projectId: task.projectId,
          taskId: task.id,
          assigneeTeamIds,
        },
      }),
    onMutate: async (assigneeTeamIds) => {
      setAssignError(null)
      await client.cancelQueries({ queryKey: tasksKey })
      const current = client.getQueryData<ProjectTasksCache>(tasksKey)
      const currentRow = current?.tasks.find((row) => row.id === task.id)

      // Row not in the cache (or the surface not mounted with one): skip the
      // patch but still send the request — the settle refetch repaints.
      if (!current || !currentRow) {
        return { assignees: null, row: null }
      }

      // Optimistic refs resolve team ids through the member pool, so the
      // faces swap instantly. The refs use the team id as a stand-in
      // identity until the refetch stamps the real `project_members` id —
      // they only need to render and key. Unknown ids are skipped: the
      // server refuses half-resolvable sets, and the settle refetch says so.
      const nextAssignees: TaskAssigneeRef[] = assigneeTeamIds.flatMap(
        (teamId) => {
          const person = members?.find((member) => member.teamId === teamId)
          if (!person) return []
          return [
            {
              projectMemberId: person.teamId,
              name: person.name,
              email: person.email,
              image: person.image,
            },
          ]
        }
      )

      // Map-by-id so only this row moves — the rest of the cached list,
      // including the create-composer's optimistic rows, stays as it is.
      client.setQueryData<ProjectTasksCache>(tasksKey, {
        ...current,
        tasks: current.tasks.map((row) =>
          row.id === task.id ? { ...row, assignees: nextAssignees } : row
        ),
      })

      // Snapshot only what this write can break: the row's previous
      // assignees (the row itself carried defensively), not the whole list.
      return { assignees: currentRow.assignees, row: currentRow }
    },
    onError: (caught, _variables, context) => {
      // Restore only this row's assignees, never the full-list snapshot that
      // onMutate saw: would also revert every assign change that landed in
      // the cache while this request was in flight — including other
      // people's. Same surgical rollback the update composer applies.
      const previous = context?.assignees
      if (previous) {
        client.setQueryData<ProjectTasksCache>(tasksKey, (current) => {
          if (!current) return current
          return {
            ...current,
            tasks: current.tasks.map((row) =>
              row.id === task.id ? { ...row, assignees: previous } : row
            ),
          }
        })
      }
      setAssignError(
        caught instanceof Error ? caught.message : "Could not update assignees."
      )
    },
    onSettled: () => {
      // The parent repaints the project lists; assignment also moves the
      // viewer in and out of "my tasks", so the server-derived badge and
      // page counts follow the write.
      onChanged()
      void client.invalidateQueries({ queryKey: taskKeys.badge(workspaceSlug) })
      void client.invalidateQueries({ queryKey: taskKeys.mine(workspaceId) })
    },
  })

  const assignees = task.assignees ?? []
  const assigneeLabel = assignees
    .map((assignee) => assignee.name ?? assignee.email ?? "Member")
    .join(" and ")

  // Best-effort "who is marked assigned" per picker row: fresh from the
  // optimistic patch the ref carries the team id; server-fetched refs carry
  // the membership id, where a shared email is the closest identity the two
  // id spaces have.
  function isAssigned(member: AssignableMember) {
    return assignees.some(
      (assignee) =>
        assignee.projectMemberId === member.teamId ||
        (assignee.email !== null && assignee.email === member.email)
    )
  }

  return (
    <div className="flex flex-col gap-1 rounded-md border bg-background/60 px-2.5 py-2">
      <div className="flex flex-wrap items-center gap-2">
        {canMove ? (
          // The house pill (status-chip.tsx's `Chip` pattern): the whole
          // state list with its colour dots — current checked, the machine's
          // legal moves enabled, the rest dimmed.
          <Chip
            placeholder={status.label}
            icon={
              <span
                aria-hidden
                className={cn("size-3 rounded-full", TASK_DOTS[task.status])}
              />
            }
            label={status.label}
          >
            <div className="flex flex-col gap-0.5">
              {TASK_STATUS_ORDER.map((value) => {
                const legal = targets.includes(value)
                return (
                  <ChipOption
                    key={value}
                    selected={value === task.status}
                    disabled={!legal}
                    onSelect={() => void move(value)}
                    title={
                      legal
                        ? TASK_STATUS_META[value].label
                        : `${TASK_STATUS_META[value].label} — not a legal move`
                    }
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "size-3.5 shrink-0 rounded-full",
                        TASK_DOTS[value]
                      )}
                    />
                  </ChipOption>
                )
              })}
            </div>
          </Chip>
        ) : (
          // Same pill face, inert — the machine and optimistic rows forbid it.
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground ring-1 ring-border">
            <span
              aria-hidden
              className={cn("size-3 rounded-full", TASK_DOTS[task.status])}
            />
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
            to="/w/$workspaceSlug/projects/$projectSlug/tasks/$taskId"
            params={{ workspaceSlug, projectSlug, taskId: task.id }}
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

          {canAssign ? (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 py-0.5 hover:opacity-80"
                  aria-label={
                    assigneeLabel
                      ? `Assignees: ${assigneeLabel}. Change assignees.`
                      : "Assign someone"
                  }
                >
                  {assignees.length > 0 ? (
                    <span aria-hidden className="flex -space-x-1.5">
                      {assignees.map((assignee) => (
                        <span
                          key={assignee.projectMemberId}
                          title={assignee.name ?? assignee.email ?? "Member"}
                          className="flex size-5 items-center justify-center rounded-full border bg-muted text-[10px] font-medium"
                        >
                          {(assignee.name?.trim()[0] ?? "?").toUpperCase()}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span
                      aria-hidden
                      className="flex size-5 items-center justify-center rounded-full border bg-muted"
                    >
                      <UserPlusIcon className="size-3" />
                    </span>
                  )}
                  <ChevronDownIcon className="size-3 opacity-70" />
                </button>
              </PopoverTrigger>
              {/* Same pill columns as the status popover (ChipOption), the
                  faces as the leading element, an unassign escape at the end. */}
              <PopoverContent align="end" className="w-72 p-1">
                <div className="flex flex-col gap-0.5">
                  {members.map((member) => {
                    const assigned = isAssigned(member)
                    return (
                      <ChipOption
                        key={member.teamId}
                        selected={assigned}
                        disabled={assigned}
                        onSelect={() => assign.mutate([member.teamId])}
                        title={member.name ?? member.email ?? "Member"}
                      >
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium">
                          {(member.name?.trim()[0] ?? "?").toUpperCase()}
                        </span>
                      </ChipOption>
                    )
                  })}
                  {assignees.length > 0 && (
                    <>
                      <div aria-hidden className="mx-2 my-1 h-px bg-border" />
                      <ChipOption
                        selected={false}
                        onSelect={() => assign.mutate([])}
                        title="Unassign"
                      />
                    </>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          ) : (task.assignees?.length ?? 0) > 0 ? (
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
          ) : undefined}
        </div>
      </div>

      {task.description && (
        <p className="line-clamp-1 text-xs text-muted-foreground">
          {task.description}
        </p>
      )}

      {assignError && (
        <p role="alert" className="text-xs text-destructive">
          {assignError}
        </p>
      )}
    </div>
  )
}
