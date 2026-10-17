import { useState } from "react"
import { Loader2Icon, LinkIcon, UploadIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  submitVersionFn,
} from "@/server/functions/versions"
import {
  validateAssetFile,
  uploadAsset,
} from "@/components/projects/cloudinary-assets"

/**
 * One submission (FR-019/020): a link to an external file first, a hosted
 * upload second. Same-name submissions across the project become versions of
 * that asset's history, so the filename is the identity the composer guards.
 */
export function VersionComposer({
  workspaceId,
  projectId,
  deliverableId,
  defaultFilename,
  onSaved,
  onCancel,
}: {
  workspaceId: string
  projectId: string
  deliverableId: string
  /** Set when expanding an existing asset — the filename locks to it. */
  defaultFilename?: string
  onSaved: () => void
  onCancel?: () => void
}) {
  const [filename, setFilename] = useState(defaultFilename ?? "")
  const [label, setLabel] = useState("")
  const [notes, setNotes] = useState("")
  const [mode, setMode] = useState<"link" | "upload">("link")
  const [url, setUrl] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Same env contract the feed composer and avatars use; unset means the
  // preset was never provisioned, and the copy says so instead of failing.
  const uploadsConfigured = Boolean(
    import.meta.env.VITE_CLOUDINARY_CLOUD_NAME &&
      import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
  )

  async function run() {
    setBusy(true)
    setError(null)
    try {
      // zod accepts the trimmed forms; the empty-string guards keep an
      // accidental blank from becoming a nameless version.
      const trimmedLabel = label.trim()
      const submitterNotes = notes.trim().length > 0 ? notes.trim() : undefined
      const name = filename.trim()

      if (mode === "link") {
        await submitVersionFn({
          data: {
            workspaceId,
            projectId,
            deliverableId,
            filename: name,
            label: trimmedLabel.length > 0 ? trimmedLabel : undefined,
            submitterNotes,
            source: "external_link",
            url: url.trim(),
          },
        })
      } else {
        if (!file) throw new Error("Choose a file to upload.")
        const fileError = validateAssetFile(file)
        if (fileError) throw new Error(fileError)
        const uploaded = await uploadAsset(file)
        await submitVersionFn({
          data: {
            workspaceId,
            projectId,
            deliverableId,
            // An upload always carries its real filename; the field only
            // exists locked to an existing asset's name.
            filename: name || file.name,
            label: trimmedLabel.length > 0 ? trimmedLabel : undefined,
            submitterNotes,
            source: "upload",
            provider: "cloudinary",
            providerKey: uploaded.providerKey,
            url: uploaded.url,
            mimeType: uploaded.mimeType,
            sizeBytes: uploaded.sizeBytes,
          },
        })
      }
      onSaved()
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not submit the version."
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center gap-1" role="tablist" aria-label="How this file arrives">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "link"}
          onClick={() => setMode("link")}
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
            mode === "link"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
          }`}
        >
          <LinkIcon className="size-3.5" />
          Link
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "upload"}
          disabled={!uploadsConfigured}
          onClick={() => uploadsConfigured && setMode("upload")}
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
            mode === "upload"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
          } ${uploadsConfigured ? "" : "cursor-not-allowed opacity-50"}`}
        >
          <UploadIcon className="size-3.5" />
          Upload
        </button>
      </div>

      <div className="grid gap-3">
        <Input
          aria-label="File name"
          placeholder="e.g. keynotes.pdf"
          value={filename}
          disabled={defaultFilename !== undefined}
          onChange={(event) => setFilename(event.target.value)}
          maxLength={255}
        />

        {mode === "link" ? (
          <>
            <Input
              aria-label="Link to the file"
              placeholder="https://…"
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
            />
            {/* FR-025/038: say exactly what a link is and is not. */}
            <p className="text-xs text-muted-foreground">
              Links to a file stored outside Antara. Antara cannot detect if
              that file changes later — even after this version is approved.
            </p>
          </>
        ) : (
          <>
            <Input
              aria-label="Choose a file to upload"
              type="file"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-muted-foreground">
              Uploaded files are stored on the workspace's file provider, and
              Antara keeps its own reference for moving to new versions.
            </p>
          </>
        )}

        <Input
          aria-label="Version label (optional)"
          placeholder="Label (optional — defaults to v<next>)"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          maxLength={80}
        />
        <Textarea
          aria-label="What changed (optional)"
          placeholder="What changed in this version? (optional)"
          rows={2}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          maxLength={2000}
        />
      </div>

      {error && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      )}

      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" disabled={busy || filename.trim().length === 0} onClick={() => void run()}>
          {busy ? <Loader2Icon className="size-4 animate-spin" /> : null}
          Submit version
        </Button>
        {onCancel && (
          <Button size="sm" variant="ghost" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  )
}
