import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2Icon, SendIcon } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useSession } from "@/lib/auth-client"
import { formatRelativeTime } from "@/lib/time"
import {
  buildOptimisticVersionFeedback,
  versionKeys,
  versionThreadQuery,
} from "@/lib/queries/versions"
import { addVersionFeedbackFn } from "@/server/functions/versions"
import type { VersionThreadMessage } from "@/server/services/version-service"

/**
 * The feedback thread on one version (FR-027). The unified comments table
 * carries it — same surface the request brief uses, scoped to a version row.
 * Members post; the server resolves who a member even is. Posting is
 * optimistic: the entry renders instantly under the session user's name and
 * is dropped again if the write fails.
 */
export function VersionThread({
  workspaceId,
  projectId,
  versionId,
  onChanged,
}: {
  workspaceId: string
  projectId: string
  versionId: string
  onChanged: () => void
}) {
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  const [body, setBody] = useState("")
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    data: messages = [],
    isPending,
    error,
  } = useQuery(versionThreadQuery(workspaceId, projectId, versionId))

  const threadKey = versionKeys.thread(versionId)

  const post = useMutation({
    // The body rides in as the mutation variable: the optimistic row is built
    // from what was typed at mutate time, not from whatever state holds later.
    mutationFn: (messageBody: string) =>
      addVersionFeedbackFn({
        data: { workspaceId, projectId, versionId, body: messageBody },
      }),
    onMutate: async (messageBody) => {
      await queryClient.cancelQueries({ queryKey: threadKey })

      // Coalesced to an empty thread on purpose: the very first post happens
      // against a cache that does not exist yet, and skipping the write there
      // would strand the row. Oldest-first thread, so the entry lands at the
      // end — where the server's row will sit after the settle refetch.
      const snapshot =
        queryClient.getQueryData<VersionThreadMessage[]>(threadKey) ?? []
      const optimistic = buildOptimisticVersionFeedback(messageBody, {
        authorId: session?.user.id ?? "",
        authorName: session?.user.name ?? null,
        authorEmail: session?.user.email ?? null,
      })
      queryClient.setQueryData<VersionThreadMessage[]>(threadKey, [
        ...snapshot,
        optimistic,
      ])

      return { optimisticId: optimistic.id }
    },
    onError: (_error, _messageBody, context) => {
      // Rollback drops just this entry by its optimistic id: restoring the
      // snapshot would also revert anything that landed in the thread while
      // the post was in flight — including other people's feedback.
      queryClient.setQueryData<VersionThreadMessage[]>(
        threadKey,
        (current = []) =>
          current.filter((row) => row.id !== context?.optimisticId)
      )
      setServerError("Could not post the feedback.")
    },
    onSuccess: () => {
      // Cleared only once the server has the message — a rejected post keeps
      // what was typed and can be retried.
      setBody("")
      setServerError(null)
    },
    onSettled: () => {
      onChanged()
    },
  })

  if (isPending) {
    return (
      <p className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin" />
        Loading feedback…
      </p>
    )
  }

  if (error) {
    return (
      <p role="alert" className="px-4 py-3 text-sm text-destructive">
        {error instanceof Error
          ? error.message
          : "Could not load the feedback."}
      </p>
    )
  }

  return (
    <div>
      <div className="flex flex-col divide-y border-y">
        {messages.length === 0 && (
          <p className="px-4 py-3 text-sm text-muted-foreground">
            No feedback yet. Reviewers explain changes here; the team sees it
            next to the version.
          </p>
        )}
        {messages.map((message) => (
          <MessageRow key={message.id} message={message} />
        ))}
      </div>

      <form
        className="flex items-end gap-2 p-3"
        onSubmit={(event) => {
          event.preventDefault()
          if (body.trim().length > 0) post.mutate(body.trim())
        }}
      >
        <Textarea
          aria-label="Write feedback"
          rows={2}
          className="min-h-11"
          placeholder="Give feedback on this version…"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault()
              if (body.trim().length > 0) post.mutate(body.trim())
            }
          }}
        />
        <Button
          type="submit"
          size="icon"
          disabled={body.trim().length === 0 || post.isPending}
        >
          {post.isPending ? (
            <Loader2Icon className="animate-spin" />
          ) : (
            <SendIcon />
          )}
          <span className="sr-only">Post feedback</span>
        </Button>
      </form>

      {serverError && (
        <p role="alert" className="px-4 pb-3 text-sm text-destructive">
          {serverError}
        </p>
      )}
    </div>
  )
}

function MessageRow({ message }: { message: VersionThreadMessage }) {
  return (
    <div className="flex gap-3 px-4 py-3">
      <span
        aria-hidden
        className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium"
      >
        {(message.authorName?.trim()[0] ?? "?").toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {message.authorName ?? "Former member"}
          </span>
          <span aria-hidden> · </span>
          {formatRelativeTime(message.createdAt)}
        </p>
        <p className="mt-0.5 text-sm break-words whitespace-pre-wrap">
          {message.body}
        </p>
      </div>
    </div>
  )
}
