import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2Icon, SendIcon } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { formatRelativeTime } from "@/lib/time"
import { requestKeys, requestThreadQuery } from "@/lib/queries/requests"
import { requestThreadPostFn } from "@/server/functions/requests"
import type { RequestThreadMessage } from "@/server/services/request-service"

/**
 * The brief thread (FR-009): every workspace member can read it and post to
 * it — the requester answering, the lead asking, the triage decision landing.
 * Invalidation is deliberately blunt: any write repaints the whole
 * request-scoped family (thread, card, inbox, sidebar badge) because they are
 * all facets of the same record.
 */
export function RequestThread({
  workspaceId,
  requestId,
}: {
  workspaceId: string
  requestId: string
}) {
  const queryClient = useQueryClient()
  const [body, setBody] = useState("")
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    data: messages = [],
    isPending,
    error,
  } = useQuery(requestThreadQuery(workspaceId, requestId))

  const post = useMutation({
    mutationFn: async () => {
      await requestThreadPostFn({
        data: { workspaceId, requestId, body: body.trim() },
      })
    },
    onSuccess: async () => {
      setBody("")
      setServerError(null)
      await queryClient.invalidateQueries({ queryKey: requestKeys.all })
    },
    onError: () => {
      setServerError("Could not post the message.")
    },
  })

  return (
    <section className="rounded-xl bg-muted/40">
      <h2 className="px-4 pt-3 pb-1 text-sm font-medium tracking-tight">
        Brief thread
      </h2>

      <div className="flex flex-col">
        {isPending ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">
            Loading messages…
          </p>
        ) : error ? (
          <div role="alert" className="px-4 py-3 text-sm text-destructive">
            {error instanceof Error
              ? error.message
              : "Could not load the thread."}
          </div>
        ) : messages.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">
            No messages yet. Questions and answers about this request live here.
          </p>
        ) : (
          messages.map((message) => (
            <MessageRow key={message.id} message={message} />
          ))
        )}
      </div>

      <form
        className="flex items-end gap-2 p-3"
        onSubmit={(event) => {
          event.preventDefault()
          if (body.trim().length > 0) post.mutate()
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
              if (body.trim().length > 0) post.mutate()
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
        <p role="alert" className="px-4 pb-3 text-sm text-destructive">
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
