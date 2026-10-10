import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { Loader2, PaperclipIcon, SendIcon, XIcon } from "lucide-react"
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

/**
 * The progress-update composer.
 *
 * Attachments upload to the provider *before* the update is posted, so the
 * server receives URLs rather than bytes and no request handler ever holds a
 * 90MB video. The trade-off is that a failed upload leaves an orphaned provider
 * file — the alternative (uploading inside the transaction) is not possible
 * across a third party, and it is what the deletion queue in phase 3 will
 * reconcile.
 *
 * The post itself is optimistic: the row appears in the feed immediately with
 * object-URL previews, and rolls back if the write fails.
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
  const [uploading, setUploading] = useState(false)
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
    mutationFn: async (payload: {
      body: string
      kind: UpdateKind
      attachments: { file: File; url: string }[]
      previews: StagedFile[]
    }) => {
      // Upload first, so a provider failure surfaces before the optimistic row
      // is written rather than rolling it back a moment later.
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
      const snapshot = client.getQueryData<ProjectUpdateItem[]>(updatesKey)

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

      client.setQueryData<ProjectUpdateItem[]>(updatesKey, (current = []) => [
        optimistic,
        ...current,
      ])

      return { snapshot }
    },
    onError: (err, _variables, context) => {
      if (context?.snapshot) {
        client.setQueryData(updatesKey, context.snapshot)
      }
      setError(err instanceof Error ? err.message : "Could not send.")
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
    if (!trimmed || mutation.isPending || uploading) return
    setUploading(true)
    try {
      await mutation.mutateAsync({
        body: trimmed,
        kind,
        attachments: staged.map((entry) => ({
          file: entry.file,
          url: entry.url,
        })),
        previews: staged,
      })
    } catch {
      // onError already surfaced it; swallow so this stays an unhandled-free
      // promise.
    } finally {
      setUploading(false)
    }
  }

  const busy = mutation.isPending || uploading

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card p-2">
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
          className="resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
        />
        <InputGroupAddon align="inline-end">
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
          <InputGroupButton
            type="button"
            size="icon-sm"
            aria-label="Send update"
            disabled={busy || body.trim().length === 0}
            onClick={() => void handleSubmit()}
          >
            {busy ? <Loader2 className="animate-spin" /> : <SendIcon />}
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
