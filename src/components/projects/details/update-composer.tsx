import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { PaperclipIcon, SendIcon, XIcon } from "lucide-react"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import {
  uploadAsset,
  validateAssetFile,
} from "@/components/projects/cloudinary-assets"
import { KindToggle } from "@/components/projects/details/kind-toggle"
import { createProjectUpdateFn } from "@/server/functions/projects"
import { buildOptimisticUpdate, projectKeys } from "@/lib/queries/projects"
import { useSession } from "@/lib/auth-client"
import type { ProjectUpdateItem } from "@/server/services/project-update-service"
import type { UpdateKind } from "@/db/enums"

interface StagedFile {
  file: File
  url: string
}

/** What one send carries. Both post kinds use this shape. */
interface PostPayload {
  body: string
  kind: UpdateKind
  attachments: { file: File; url: string }[]
}

/**
 * Turns a send failure into something worth showing. The upload step and the
 * save step fail for different reasons, so they say different things — a
 * missing Cloudinary preset is a setup problem, not something the user did.
 */
function describeFailure(error: unknown): string {
  if (!(error instanceof Error)) return "Could not send your message."
  if (error.message.includes("not configured")) {
    return "File uploads are not configured yet. Send without attachments."
  }
  if (error.message.includes("Could not upload")) {
    return `${error.message} Nothing else was sent.`
  }
  return `Could not send. ${error.message}`
}

/**
 * Composer for both post kinds — a running comment or a progress update. They
 * share this component, this mutation and this optimistic path; only the label
 * and the badge differ.
 *
 * Posting is optimistic. The row is written into the feed cache before the
 * request, showing object-URL previews for any staged files, and is removed
 * again if the write fails. The composer's text is deliberately *not* cleared
 * until success, so a rejected post can be retried without retyping it.
 *
 * Attachments upload to the provider rather than through the server, so no
 * request handler ever holds a 90MB video. The cost is that an upload failure
 * has to roll the row back after the fact, and that a provider file can be
 * orphaned when the update itself then fails to save.
 */
export function UpdateComposer({
  workspaceId,
  projectId,
}: {
  workspaceId: string
  projectId: string
}) {
  const client = useQueryClient()
  const { data: session } = useSession()
  const [body, setBody] = useState("")
  const [kind, setKind] = useState<UpdateKind>("comment")
  const [staged, setStaged] = useState<StagedFile[]>([])
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const updatesKey = projectKeys.updates(workspaceId, projectId)

  // Object URLs outlive the row that shows them unless revoked, and this
  // component unmounts when the route changes. Release whatever is still held.
  const stagedRef = useRef(staged)
  stagedRef.current = staged
  useEffect(() => {
    return () => {
      for (const entry of stagedRef.current) {
        if (entry.url.startsWith("blob:")) URL.revokeObjectURL(entry.url)
      }
    }
  }, [])

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setError(null)

    const next: StagedFile[] = []
    for (const file of Array.from(files)) {
      const problem = validateAssetFile(file)
      if (problem) {
        setError(problem)
        continue
      }
      next.push({ file, url: URL.createObjectURL(file) })
    }
    if (next.length > 0) setStaged((current) => [...current, ...next])
  }

  function removeStaged(index: number) {
    setStaged((current) => {
      const entry = current[index]
      if (entry.url.startsWith("blob:")) URL.revokeObjectURL(entry.url)
      return current.filter((_, i) => i !== index)
    })
  }

  const mutation = useMutation({
    mutationFn: async (payload: PostPayload) => {
      // Uploads run inside mutationFn, which TanStack invokes *after* onMutate
      // has already written the optimistic row. So the post appears in the
      // feed immediately and a slow upload does not hold it back — the trade is
      // that a provider failure has to roll the row back after the fact.
      const uploaded = await Promise.all(
        payload.attachments.map(async (entry) => ({
          ...entry,
          asset: await uploadAsset(entry.file),
        }))
      )

      return createProjectUpdateFn({
        data: {
          workspaceId,
          projectId,
          body: payload.body,
          kind: payload.kind,
          attachments: uploaded.map((entry) => ({
            filename: entry.file.name,
            url: entry.asset.url,
            provider: "cloudinary" as const,
            providerKey: entry.asset.providerKey,
            mimeType: entry.asset.mimeType,
            sizeBytes: entry.asset.sizeBytes,
          })),
        },
      })
    },
    onMutate: async (payload) => {
      setError(null)
      await client.cancelQueries({ queryKey: updatesKey })

      // Coerced to an array rather than left undefined. On the project's very
      // first post there is no cached feed yet, so `getQueryData` returns
      // undefined — and `if (context?.snapshot)` in onError would then skip the
      // restore, leaving the optimistic row stranded with no way to remove it.
      const snapshot =
        client.getQueryData<ProjectUpdateItem[]>(updatesKey) ?? []

      const optimistic = buildOptimisticUpdate({
        body: payload.body,
        kind: payload.kind,
        author: {
          id: session?.user.id ?? "",
          name: session?.user.name ?? null,
          email: session?.user.email ?? null,
          image: session?.user.image ?? null,
        },
        attachments: payload.attachments,
      })

      client.setQueryData<ProjectUpdateItem[]>(updatesKey, [
        optimistic,
        ...snapshot,
      ])

      return { snapshot, optimisticId: optimistic.id }
    },
    onError: (err, _variables, context) => {
      // Rollback: drop this post and nothing else. Restoring the whole snapshot
      // would also revert any update that landed in the feed while this one was
      // in flight — including someone else's.
      client.setQueryData<ProjectUpdateItem[]>(updatesKey, (current = []) =>
        current.filter((row) => row.id !== context?.optimisticId)
      )

      // Text and staged files are left alone deliberately: a rejected post
      // should be retryable without retyping, and the previews are still
      // referenced by the chips rather than by the row we just removed.
      setError(describeFailure(err))
    },
    onSuccess: () => {
      // Only now are the previews dead: the feed is showing server URLs.
      for (const entry of stagedRef.current) {
        if (entry.url.startsWith("blob:")) URL.revokeObjectURL(entry.url)
      }
      setStaged([])
      setBody("")
      // Kind resets too, so the next post starts from the quieter default
      // rather than inheriting whatever the last one happened to be.
      setKind("comment")
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: updatesKey })
    },
  })

  async function handleSubmit() {
    const trimmed = body.trim()
    if (!trimmed || mutation.isPending) return

    try {
      await mutation.mutateAsync({
        body: trimmed,
        kind,
        attachments: staged.map((entry) => ({
          file: entry.file,
          url: entry.url,
        })),
      })
    } catch {
      // onMutate already rolled the row back and onError already said why.
      // Swallow so the click handler has no unhandled rejection.
    }
  }

  // One flag, not two. `mutation.isPending` already spans the upload, because
  // the upload runs inside mutationFn — a separate `uploading` state was
  // tracking the same thing a moment later and could disagree with it.
  const busy = mutation.isPending

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card p-3">
      {/* The gap between the toggle and the textarea is deliberately wider
          than the rest of the stack: the two are separate decisions — what
          kind of post this is, versus what it says — and reading them as one
          control would make the toggle look like a prefix on the textarea. */}
      <KindToggle kind={kind} onChange={setKind} disabled={busy} />

      <InputGroup className="border-0 shadow-none">
        <InputGroupTextarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={
            kind === "progress_update"
              ? "What changed since the last update?"
              : "Write a comment…"
          }
          aria-label={
            kind === "progress_update" ? "Progress update" : "Comment"
          }
          maxLength={4000}
          rows={3}
          onKeyDown={(e) => {
            // Enter sends, Shift+Enter is a newline — the convention people
            // already have from every other comment box.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              void handleSubmit()
            }
          }}
          // pl-4 rather than the inherited px-2.5, so the text starts at the
          // same inset the send icon sits at from the right edge: 8px of
          // button padding plus the addon's own 8px. Matching them is what makes
          // the field read as one block instead of text pushed away from an
          // icon.
          className="resize-none border-0 bg-transparent pl-4 shadow-none focus-visible:ring-0"
        />
        <InputGroupAddon
          align="inline-end"
          // `self-end` pins the buttons to the bottom of a multi-row textarea
          // rather than the vertical centre, where they read as belonging to
          // the middle of the text. `mb-1` is the 4px gap off the bottom edge.
          className="mb-1 self-end has-[>button]:mr-0"
        >
          <InputGroupButton
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="Attach files"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            <PaperclipIcon />
          </InputGroupButton>
          {/* Primary: sending is the point of this control, and it is the
              only thing the composer commits. Attach stays ghost so the two
              buttons do not compete for the same weight. */}
          <InputGroupButton
            type="button"
            size="icon-sm"
            variant="default"
            aria-label="Send update"
            // Disabled rather than spinning: the post is already in the feed by
            // the time this is clickable again, so there is nothing for a
            // spinner to describe. `aria-busy` still reports it to assistive
            // tech, where a spinner would be invisible anyway.
            aria-busy={busy}
            disabled={busy || body.trim().length === 0}
            onClick={() => void handleSubmit()}
          >
            <SendIcon />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>

      <input
        ref={fileRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          void handleFiles(e.target.files)
          // Reset so picking the same file twice still fires a change event.
          e.target.value = ""
        }}
      />

      {staged.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 px-1 pb-1">
          {staged.map((entry, index) => (
            <li
              key={`${entry.file.name}-${index}`}
              className="flex items-center gap-1.5 rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
            >
              <span className="max-w-40 truncate">{entry.file.name}</span>
              <button
                type="button"
                aria-label={`Remove ${entry.file.name}`}
                onClick={() => removeStaged(index)}
                className="rounded-full opacity-60 transition-opacity hover:opacity-100"
              >
                <XIcon className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" className="px-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
