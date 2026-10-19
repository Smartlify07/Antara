import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Loader2Icon } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createTaskFn } from "@/server/functions/tasks"
import {
  buildOptimisticTask,
  insertTaskCard,
  taskKeys,
} from "@/lib/queries/tasks"
import type { ProjectTasksCache } from "@/lib/queries/tasks"
import type { AssignableMember } from "@/server/services/project-service"

/** What one create carries; scope ids ride along from the props. */
interface TaskPayload {
  title: string
  dueDate: string | undefined
  assigneeTeamIds: string[] | undefined
}

/**
 * The inline "add a task" composer (FR-016): one input for the title, a
 * due-date and assignee picker that stay collapsed until expanded. Deliverables
 * embed it under their card; the loose-tasks bucket reuses the same atom.
 *
 * Creating is optimistic. The row is written into the project's task cache
 * before the request, so a slow write does not hold the list back, and it is
 * removed again if the write fails. The composer's fields are deliberately
 * not cleared until success, so a rejected task is retryable without
 * retyping.
 */
export function TaskComposer({
  workspaceId,
  projectId,
  deliverableId,
  members,
  onCreated,
}: {
  workspaceId: string
  projectId: string
  deliverableId?: string
  /** Project members (the only people a task may be assigned to). */
  members: AssignableMember[]
  onCreated: () => void
}) {
  const client = useQueryClient()
  const [title, setTitle] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [assignee, setAssignee] = useState("")
  const [expand, setExpand] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const tasksKey = taskKeys.byProject(projectId)

  const mutation = useMutation({
    mutationFn: (payload: TaskPayload) =>
      createTaskFn({
        data: {
          workspaceId,
          projectId,
          deliverableId: deliverableId ?? null,
          title: payload.title,
          dueDate: payload.dueDate,
          assigneeTeamIds: payload.assigneeTeamIds,
          // Create flow deliberately owns the shape at default values.
          priority: undefined,
        },
      }),
    onMutate: async (payload) => {
      setError(null)
      await client.cancelQueries({ queryKey: tasksKey })

      // The project cache is a `{ tasks, viewer }` object, not a flat array:
      // only `tasks` is patched — `viewer` is an access fact resolved
      // server-side, and a pre-write patch cannot recompute it, so it rides
      // along untouched. With no cache at all — the project's tasks query has
      // not landed yet — there is nothing to paint the row into, and neither
      // this patch nor the rollback below writes one into existence.
      const current = client.getQueryData<ProjectTasksCache>(tasksKey)
      if (!current) return { snapshot: null, optimisticId: null }

      const optimistic = buildOptimisticTask(
        {
          title: payload.title,
          dueDate: payload.dueDate,
          deliverableId: deliverableId ?? null,
          assigneeTeamIds: payload.assigneeTeamIds,
        },
        projectId,
        members
      )

      client.setQueryData<ProjectTasksCache>(tasksKey, {
        ...current,
        tasks: insertTaskCard(current.tasks, optimistic),
      })

      return { snapshot: current, optimisticId: optimistic.id }
    },
    onError: (caught, _payload, context) => {
      // Rollback: drop this task and nothing else, by its optimistic id.
      // Restoring the whole snapshot would also revert any task that landed
      // in the list while this one was in flight — including someone else's.
      client.setQueryData<ProjectTasksCache>(tasksKey, (existing) =>
        existing
          ? {
              ...existing,
              tasks: existing.tasks.filter(
                (row) => row.id !== context?.optimisticId
              ),
            }
          : existing
      )

      // Title, due date and assignee are left alone deliberately: a rejected
      // task should be retryable without retyping.
      setError(
        caught instanceof Error ? caught.message : "Could not add the task."
      )
    },
    onSuccess: () => {
      // Only now are the fields dead — cleared on success, so a failed
      // create keeps what was typed and can be retried.
      setTitle("")
      setDueDate("")
      setAssignee("")
      setExpand(false)
      setError(null)
    },
    onSettled: () => {
      // The parent panel's refresh is what completes the turn: it invalidates
      // the task list this composer already patched, the deliverable list and
      // the header's task-count prefix of `projectKeys.detail`, and the settle
      // it triggers is what swaps the placeholder for the server's row. The
      // sidebar badge is server-derived and settles on its own refetch; the
      // composer has no workspaceSlug prop, so it cannot (and must not) reach
      // `taskKeys.badge` itself.
      onCreated()
    },
  })

  function submit() {
    const trimmed = title.trim()
    if (!trimmed) {
      setError("Name the task.")
      return
    }
    if (mutation.isPending) return

    mutation.mutate({
      title: trimmed,
      dueDate: dueDate || undefined,
      assigneeTeamIds: assignee ? [assignee] : undefined,
    })
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Add a task…"
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault()
              void submit()
            }
          }}
          onFocus={() => setExpand(true)}
          className="h-8 bg-background text-sm"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 shrink-0"
          onClick={() => void submit()}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? (
            <Loader2Icon className="size-3.5 animate-spin" />
          ) : (
            "Add"
          )}
        </Button>
      </div>

      {expand && (
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            aria-label="Due date"
            className="h-8 bg-background text-xs"
          />
          <select
            value={assignee}
            onChange={(event) => setAssignee(event.target.value)}
            aria-label="Assignee"
            className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-xs outline-none"
          >
            <option value="">Unassigned</option>
            {members.map((member) => (
              <option key={member.teamId} value={member.teamId}>
                {member.name ?? member.email ?? "Member"}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
