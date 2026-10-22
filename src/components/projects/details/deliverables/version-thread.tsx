import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useSession } from "@/lib/auth-client"
import {
  buildOptimisticVersionFeedback,
  versionKeys,
  versionThreadQuery,
} from "@/lib/queries/versions"
import { addVersionFeedbackFn } from "@/server/functions/versions"
import type { VersionThreadMessage } from "@/server/services/version-service"
import {
  ThreadComposer,
  ThreadEmpty,
  ThreadError,
  ThreadLoading,
  ThreadRow,
} from "@/components/projects/details/deliverables/work-comments"

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
    return <ThreadLoading label="Loading feedback…" />
  }

  if (error) {
    return (
      <ThreadError>
        {error instanceof Error
          ? error.message
          : "Could not load the feedback."}
      </ThreadError>
    )
  }

  return (
    <div>
      <div className="flex flex-col">
        {messages.length === 0 && (
          <ThreadEmpty>
            No feedback yet. Reviewers explain changes here; the team sees it
            next to the version.
          </ThreadEmpty>
        )}
        {messages.map((message) => (
          <ThreadRow key={message.id} message={message} />
        ))}
      </div>

      <ThreadComposer
        value={body}
        onChange={setBody}
        onSubmit={() => post.mutate(body.trim())}
        pending={post.isPending}
        placeholder="Give feedback on this version…"
        label="Write feedback"
      />

      {serverError && <ThreadError>Could not post the feedback.</ThreadError>}
    </div>
  )
}
