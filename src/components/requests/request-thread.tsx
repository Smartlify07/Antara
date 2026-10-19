import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2Icon, SendIcon } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useSession } from "@/lib/auth-client"
import { formatRelativeTime } from "@/lib/time"
import {
  buildOptimisticThreadMessage,
  requestKeys,
  requestThreadQuery,
} from "@/lib/queries/requests"
import { requestThreadPostFn } from "@/server/functions/requests"
import type { RequestThreadMessage } from "@/server/services/request-service"

/**
 * The brief thread (FR-009): every workspace member can read it and post to
 * it — the requester answering, the lead asking, the triage decision landing.
 * Posting is optimistic: the message renders instantly under the session
 * user's name and is dropped again if the write fails. The settle invalidation
 * is deliberately blunt: any write repaints the whole request-scoped family
 * (thread, card, inbox, sidebar badge) because they are all facets of the same
 * record.
 */
export function RequestThread({
  workspaceId,
  requestId,
}: {
  workspaceId: string
  requestId: string
}) {
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  const [body, setBody] = useState("")
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    data: messages = [],
    isPending,
    error,
  } = useQuery(requestThreadQuery(workspaceId, requestId))

  const threadKey = requestKeys.thread(requestId)

  const post = useMutation({
    // The body rides in as the mutation variable: the optimistic row is built
    // from what was typed at mutate time, not from whatever state holds later.
    mutationFn: (messageBody: string) =>
      requestThreadPostFn({
        data: { workspaceId, requestId, body: messageBody },
      }),
    onMutate: async (messageBody) => {
      await queryClient.cancelQueries({ queryKey: threadKey })

      // Coalesced to an empty thread on purpose: the very first post happens
      // against a cache that does not exist yet, and skipping the write there
      // would strand the row. Oldest-first thread, so the entry lands at the
      // end — where the server's row will sit after the settle refetch.
      const snapshot =
        queryClient.getQueryData<RequestThreadMessage[]>(threadKey) ?? []
      const optimistic = buildOptimisticThreadMessage(messageBody, {
        authorId: session?.user.id ?? "",
        authorName: session?.user.name ?? null,
        authorImage: session?.user.image ?? null,
      })
      queryClient.setQueryData<RequestThreadMessage[]>(threadKey, [
        ...snapshot,
        optimistic,
      ])

      return { optimisticId: optimistic.id }
    },
    onError: (_error, _messageBody, context) => {
      // Rollback drops just this message by its optimistic id: restoring the
      // snapshot would also revert anything that landed in the thread while
      // the post was in flight — including other people's messages.
      queryClient.setQueryData<RequestThreadMessage[]>(
        threadKey,
        (current = []) =>
          current.filter((row) => row.id !== context?.optimisticId)
      )
      setServerError("Could not post the message.")
    },
    onSuccess: () => {
      // Cleared only once the server has the message — a rejected post keeps
      // what was typed and can be retried.
      setBody("")
      setServerError(null)
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: requestKeys.all })
    },
  })

  if (isPending) {
    return (
      <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
        Loading the thread…
      </div>
    )
  }

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
      >
        {error instanceof Error ? error.message : "Could not load the thread."}
      </div>
    )
  }

  return (
    <section className="rounded-xl border bg-card">
      <h2 className="border-b px-4 py-3 text-sm font-medium tracking-tight">
        Brief thread
      </h2>

      <div className="flex flex-col divide-y">
        {messages.length === 0 && (
          <p className="px-4 py-3 text-sm text-muted-foreground">
            No messages yet. Questions and answers about this request live here.
          </p>
        )}
        {messages.map((message) => (
          <MessageRow key={message.id} message={message} />
        ))}
      </div>

      <form
        className="flex items-end gap-2 border-t p-3"
        onSubmit={(event) => {
          event.preventDefault()
          if (body.trim().length > 0) post.mutate(body.trim())
        }}
      >
        <Textarea
          aria-label="Write a message"
          rows={2}
          className="min-h-11"
          placeholder="Ask or answer something…"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={(event) => {
            // Enter sends; Shift+Enter keeps the line. Deliberate for a
            // chat-shaped surface, unlike the multi-paragraph brief form.
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
          <span className="sr-only">Post message</span>
        </Button>
      </form>

      {serverError && (
        <p role="alert" className="border-t px-4 py-2 text-sm text-destructive">
          {serverError}
        </p>
      )}
    </section>
  )
}

function MessageRow({ message }: { message: RequestThreadMessage }) {
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
