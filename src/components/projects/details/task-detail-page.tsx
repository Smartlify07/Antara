import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, notFound } from "@tanstack/react-router"
import { useState } from "react"
import { useSession } from "@/lib/auth-client"
import { formatDueDate } from "@/lib/time"
import { projectDeliverablesQuery } from "@/lib/queries/deliverables"
import { projectDetailQuery } from "@/lib/queries/projects"
import {
  buildOptimisticTaskComment,
  projectTasksQuery,
  taskKeys,
  taskThreadQuery,
} from "@/lib/queries/tasks"
import {
  TASK_DOTS,
  TASK_PRIORITY_META,
  TASK_STATUS_META,
} from "@/components/projects/details/deliverables/deliverable-meta"
import {
  ThreadComposer,
  ThreadEmpty,
  ThreadError,
  ThreadLoading,
  ThreadRow,
} from "@/components/projects/details/deliverables/work-comments"
import { addTaskCommentFn } from "@/server/functions/tasks"
import type { ProjectDetail } from "@/server/services/project-service"
import type { TaskThreadMessage } from "@/server/services/task-service"

/**
 * The task's own page: the task's full meta, the deliverable it hangs under,
 * and — the reason tasks became destinations at all — its own comment
 * thread, which a row title could never carry.
 *
 * Nothing new is queried to get here: the project comes by slug (the same
 * cache the project page fills), the task resolves out of the same project
 * list the roster and the cabinet read, and the deliverable's title — the
 * card only carries its id — comes from the list the cabinet already caches.
 * A deep link pays the round trips once; click-throughs render from cache.
 */
export function TaskDetailPage({
  workspaceId,
  workspaceSlug,
  projectSlug,
  taskId,
}: {
  workspaceId: string
  workspaceSlug: string
  projectSlug: string
  taskId: string
}) {
  const {
    data: project,
    isPending,
    error,
  } = useQuery(projectDetailQuery(workspaceId, projectSlug))

  if (isPending) {
    return <p className="text-sm text-muted-foreground">Loading project…</p>
  }

  if (error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        Could not load this project.
      </p>
    )
  }

  if (!project) throw notFound()

  return (
    <TaskDetailContent
      workspaceId={workspaceId}
      workspaceSlug={workspaceSlug}
      projectSlug={projectSlug}
      project={project}
      taskId={taskId}
    />
  )
}

/**
 * The body, mounted once the project resolves and the queries that need its
 * id can be declared. The task comes from the shared project list rather
 * than a loader of its own, so a settled list whose answer is missing means
 * the link pointed at a task that is not here — a 404, the same contract a
 * vanished project slug gets.
 */
function TaskDetailContent({
  workspaceId,
  workspaceSlug,
  projectSlug,
  project,
  taskId,
}: {
  workspaceId: string
  workspaceSlug: string
  projectSlug: string
  project: ProjectDetail
  taskId: string
}) {
  const {
    data: tasksResult,
    isPending,
    error,
  } = useQuery(projectTasksQuery(workspaceId, project.id))

  const task = tasksResult?.tasks.find((row) => row.id === taskId)

  // The card carries only the deliverable's id, so the label resolves out of
  // the deliverable list — fetched just for tasks that hang under one, and
  // skipped while the task itself is still unknown.
  const deliverables = useQuery({
    ...projectDeliverablesQuery(workspaceId, project.id),
    enabled: Boolean(task?.deliverableId),
  })
  const deliverableLabel = task?.deliverableId
    ? (deliverables.data?.deliverables.find(
        (row) => row.id === task.deliverableId
      )?.title ?? null)
    : null

  // Until the list settles, canWork is unknown — the composer simply does
  // not exist yet, and the thread renders on its own clock.
  const canWork = tasksResult?.viewer.canWork ?? false

  if (!isPending && !error && !task) throw notFound()

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col lg:max-w-4xl">
      <Link
        to="/w/$workspaceSlug/projects/$projectSlug"
        params={{ workspaceSlug, projectSlug }}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <span aria-hidden className="mr-0.5">
          ‹
        </span>
        {project.title}
      </Link>

      {isPending ? (
        <p className="mt-3 text-sm text-muted-foreground">Loading task…</p>
      ) : error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          Could not load the task.
        </p>
      ) : null}

      {task && (
        <>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">
            {task.title}
          </h1>

          {deliverableLabel && (
            <p className="mt-1 text-sm text-muted-foreground">
              Part of {deliverableLabel}
            </p>
          )}

          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className={`size-2 rounded-full ${TASK_DOTS[task.status]}`}
              />
              <span className="font-medium text-foreground">
                {TASK_STATUS_META[task.status].label}
              </span>
            </span>
            <span aria-hidden>·</span>
            <span>{TASK_PRIORITY_META[task.priority].label}</span>
            {task.dueDate && (
              <>
                <span aria-hidden>·</span>
                <span
                  className={
                    task.overdue ? "font-medium text-destructive" : undefined
                  }
                >
                  {task.overdue ? "Overdue · " : "due "}
                  {formatDueDate(task.dueDate)}
                </span>
              </>
            )}
            {task.assignees.length > 0 && (
              <>
                <span aria-hidden>·</span>
                <span className="flex -space-x-1.5" aria-label="Assignees">
                  {task.assignees.map((assignee) => (
                    <span
                      key={assignee.projectMemberId}
                      title={assignee.name ?? assignee.email ?? "Member"}
                      className="flex size-5 items-center justify-center rounded-full bg-muted text-[10px] font-medium"
                    >
                      {(assignee.name?.trim()[0] ?? "?").toUpperCase()}
                    </span>
                  ))}
                </span>
              </>
            )}
          </p>

          {task.description && (
            <p className="mt-3 text-sm leading-relaxed break-words whitespace-pre-wrap">
              {task.description}
            </p>
          )}
        </>
      )}

      <p className="mt-6 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Conversation
      </p>
      <TaskThread
        workspaceId={workspaceId}
        projectId={project.id}
        taskId={taskId}
        canPost={canWork}
      />
    </div>
  )
}

/**
 * The task's conversation (comments table, subjectType "task"), oldest
 * first. The thread renders for read-only viewers too; only the composer is
 * missing, and access arrives with the shared list's `viewer.canWork` —
 * the same fact every roster write is gated on. Posting is optimistic: the
 * entry renders instantly under the session user's name and is dropped
 * again if the write fails.
 */
function TaskThread({
  workspaceId,
  projectId,
  taskId,
  canPost,
}: {
  workspaceId: string
  projectId: string
  taskId: string
  canPost: boolean
}) {
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  const [body, setBody] = useState("")
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    data: messages = [],
    isPending,
    error,
  } = useQuery(taskThreadQuery(workspaceId, projectId, taskId))

  const threadKey = taskKeys.thread(taskId)

  const post = useMutation({
    // The body rides in as the mutation variable: the optimistic row is built
    // from what was typed at mutate time, not from whatever state holds later.
    mutationFn: (messageBody: string) =>
      addTaskCommentFn({
        data: { workspaceId, projectId, taskId, body: messageBody },
      }),
    onMutate: async (messageBody) => {
      await queryClient.cancelQueries({ queryKey: threadKey })

      // Coalesced to an empty thread on purpose: the very first post happens
      // against a cache that does not exist yet, and skipping the write there
      // would strand the row. Oldest-first thread, so the entry lands at the
      // end — where the server's row will sit after the settle refetch.
      const snapshot =
        queryClient.getQueryData<TaskThreadMessage[]>(threadKey) ?? []
      const optimistic = buildOptimisticTaskComment(messageBody, {
        authorId: session?.user.id ?? "",
        authorName: session?.user.name ?? null,
        authorEmail: session?.user.email ?? null,
      })
      queryClient.setQueryData<TaskThreadMessage[]>(threadKey, [
        ...snapshot,
        optimistic,
      ])

      return { optimisticId: optimistic.id }
    },
    onError: (_error, _messageBody, context) => {
      // Rollback drops just this entry by its optimistic id: restoring the
      // snapshot would also revert anything that landed in the thread while
      // the post was in flight — including other people's comments.
      queryClient.setQueryData<TaskThreadMessage[]>(threadKey, (current = []) =>
        current.filter((row) => row.id !== context?.optimisticId)
      )
      setServerError("Could not post the comment.")
    },
    onSuccess: () => {
      // Cleared only once the server has the message — a rejected post keeps
      // what was typed and can be retried.
      setBody("")
      setServerError(null)
    },
    onSettled: () => {
      // The optimistic append may not equal what the server wrote (another
      // comment could weave in mid-flight), so the settle refetch, not the
      // local append, is the final word.
      void queryClient.invalidateQueries({ queryKey: threadKey })
    },
  })

  if (isPending) {
    return <ThreadLoading label="Loading conversation…" />
  }

  if (error) {
    return (
      <ThreadError>
        {error instanceof Error
          ? error.message
          : "Could not load the conversation."}
      </ThreadError>
    )
  }

  return (
    <div className="flex flex-col">
      <div className="flex flex-col">
        {messages.length === 0 && (
          <ThreadEmpty>
            No comments yet. The conversation about this task starts here.
          </ThreadEmpty>
        )}
        {messages.map((message) => (
          <ThreadRow key={message.id} message={message} />
        ))}
      </div>

      {canPost && (
        <ThreadComposer
          value={body}
          onChange={setBody}
          onSubmit={() => post.mutate(body.trim())}
          pending={post.isPending}
          placeholder="Comment on this task…"
          label="Write a comment"
        />
      )}

      {serverError && <ThreadError>Could not post the comment.</ThreadError>}
    </div>
  )
}
