import {
  ChevronDownIcon,
  ChevronRightIcon,
  LinkIcon,
  Loader2Icon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"
import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Textarea } from "@/components/ui/textarea"
import { formatRelativeTime } from "@/lib/time"
import { formatBytes } from "@/components/projects/cloudinary-assets"
import { deliverableKeys } from "@/lib/queries/deliverables"
import {
  deliverableVersionsQuery,
  versionKeys,
} from "@/lib/queries/versions"
import {
  decideVersionFn,
  deleteDraftVersionFn,
  submitForReviewFn,
} from "@/server/functions/versions"
import type {
  VersionAsset,
  VersionItem,
} from "@/server/services/version-service"
import { DECISION_META, REVIEW_STATUS_META } from "./version-meta"
import { VersionComposer } from "./version-composer"
import { VersionThread } from "./version-thread"

type DecisionKind = "approved" | "rejected" | "changes_requested"

const DRAFT_META = { label: "Draft", badgeClass: "bg-muted text-muted-foreground" }

/**
 * A deliverable's version timeline (FR-021): one block per asset, newest
 * version first. Every action's MAY that renders here is a fact the server
 * stamped (`viewer.canSubmit`/`viewer.canDecide`) — and the server re-checks
 * each write, so chips and buttons only ever preview what is allowed.
 */
export function VersionsSection({
  workspaceId,
  projectId,
  deliverableId,
}: {
  workspaceSlug: string
  workspaceId: string
  projectId: string
  deliverableId: string
}) {
  const queryClient = useQueryClient()
  const { data, isPending, error } = useQuery(
    deliverableVersionsQuery(workspaceId, projectId, deliverableId)
  )
  const [composerOpen, setComposerOpen] = useState(false)
  const [composerFilename, setComposerFilename] = useState<string | undefined>(
    undefined
  )

  function openComposer(filename?: string) {
    setComposerFilename(filename)
    setComposerOpen(true)
  }

  function refresh() {
    // Blunt, like the request thread: a version write touches the timeline,
    // its thread, the Reviews queue and its badge, and the card's own count.
    // All of those live under the `versions` family on purpose.
    void queryClient.invalidateQueries({ queryKey: versionKeys.all })
    void queryClient.invalidateQueries({
      queryKey: deliverableKeys.byProject(projectId),
    })
  }

  if (isPending) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin" />
        Loading versions…
      </p>
    )
  }

  if (error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {error instanceof Error ? error.message : "Could not load versions."}
      </p>
    )
  }

  const { assets, viewer } = data

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-muted-foreground">Versions</h4>
        {viewer.canSubmit && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => openComposer(undefined)}
          >
            <PlusIcon className="size-3.5" />
            New version
          </Button>
        )}
      </div>

      {composerOpen && (
        <VersionComposer
          workspaceId={workspaceId}
          projectId={projectId}
          deliverableId={deliverableId}
          defaultFilename={composerFilename}
          onSaved={() => {
            setComposerOpen(false)
            refresh()
          }}
          onCancel={() => setComposerOpen(false)}
        />
      )}

      {assets.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-center text-muted-foreground">
          {viewer.canSubmit
            ? "No files on this deliverable yet. Submit the first version — a link to the file, or an upload."
            : "No files on this deliverable yet — its owner or the project lead will submit the first version."}
        </p>
      ) : (
        assets.map((asset) => (
          <AssetBlock
            key={asset.id}
            workspaceId={workspaceId}
            projectId={projectId}
            asset={asset}
            canSubmit={viewer.canSubmit}
            canDecide={viewer.canDecide}
            onChanged={refresh}
          />
        ))
      )}
    </div>
  )
}

function AssetBlock({
  workspaceId,
  projectId,
  asset,
  canSubmit,
  canDecide,
  onChanged,
}: {
  workspaceId: string
  projectId: string
  asset: VersionAsset
  canSubmit: boolean
  canDecide: boolean
  onChanged: () => void
}) {
  return (
    <div className="rounded-lg border bg-card p-3 pb-1">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium tracking-tight">
          {asset.filename}
          <span className="ml-2 text-xs text-muted-foreground">
            {asset.versions.length}{" "}
            {asset.versions.length === 1 ? "version" : "versions"}
          </span>
        </p>
      </div>

      <ol className="flex flex-col">
        {asset.versions.map((version) => (
          <VersionRow
            key={version.id}
            workspaceId={workspaceId}
            projectId={projectId}
            version={version}
            canSubmit={canSubmit}
            canDecide={canDecide}
            onChanged={onChanged}
          />
        ))}
      </ol>
    </div>
  )
}

function VersionRow({
  workspaceId,
  projectId,
  version,
  canSubmit,
  canDecide,
  onChanged,
}: {
  workspaceId: string
  projectId: string
  version: VersionItem
  canSubmit: boolean
  canDecide: boolean
  onChanged: () => void
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [decideKind, setDecideKind] = useState<DecisionKind | null>(null)

  const statusChip = version.reviewStatus
    ? REVIEW_STATUS_META[version.reviewStatus]
    : DRAFT_META

  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    setError(null)
    try {
      await action()
      onChanged()
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "That change did not land."
      )
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="border-t first:border-t-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 py-2 text-left"
      >
        {open ? (
          <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
        )}
        <span className="font-mono text-xs text-muted-foreground">
          {version.label}
        </span>
        {version.isLatest && (
          <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-secondary-foreground">
            Latest
          </span>
        )}
        {version.isLatestApproved && (
          <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
            Latest approved
          </span>
        )}
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusChip.badgeClass}`}
        >
          {statusChip.label}
        </span>
        <span className="ml-auto truncate text-xs text-muted-foreground">
          {version.submitter.name ?? "Former member"} ·{" "}
          {formatRelativeTime(version.createdAt)}
        </span>
      </button>

      {open && (
        <div className="pb-3 pl-6">
          <p className="text-xs text-muted-foreground">
            {version.source === "external_link" ? (
              <>
                <LinkIcon aria-hidden className="mr-1 inline size-3" />
                External link
                {version.externalProvider ? ` (${version.externalProvider})` : ""}{" "}
                —{" "}
                <a
                  href={version.url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-foreground"
                >
                  open file
                </a>
                . Antara cannot detect changes to a linked file.
              </>
            ) : (
              <>
                {version.mimeType ?? "file"}
                {version.sizeBytes !== null
                  ? ` · ${formatBytes(version.sizeBytes)}`
                  : ""}{" "}
                — hosted upload
              </>
            )}
          </p>

          {version.submitterNotes && (
            <p className="mt-1.5 text-sm break-words">
              “{version.submitterNotes}”
            </p>
          )}

          {version.decision && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              {version.decision.decision === "approved" ? "Approved" : "Rejected"}{" "}
              by{" "}
              {version.decision.approverName ??
                version.decision.approverEmail ??
                "a former member"}{" "}
              · {formatRelativeTime(version.decision.decidedAt)}
            </p>
          )}

          {error && (
            <p role="alert" className="mt-2 text-xs text-destructive">
              {error}
            </p>
          )}

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {version.reviewStatus === null && canSubmit && (
              <>
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    void run(() =>
                      submitForReviewFn({
                        data: { workspaceId, projectId, versionId: version.id },
                      })
                    )
                  }
                >
                  {busy ? (
                    <Loader2Icon className="size-4 animate-spin" />
                  ) : null}
                  Send for review
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  aria-label="Delete this draft"
                  onClick={() =>
                    void run(() =>
                      deleteDraftVersionFn({
                        data: { workspaceId, projectId, versionId: version.id },
                      })
                    )
                  }
                  title={
                    "Removes the draft. A submitted version is history — supersede it instead."
                  }
                >
                  <Trash2Icon className="size-4" />
                  Delete draft
                </Button>
              </>
            )}

            {version.reviewStatus === "submitted" && canDecide && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" disabled={busy}>
                    {busy ? (
                      <Loader2Icon className="size-4 animate-spin" />
                    ) : null}
                    Decide…
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {(
                    Object.keys(DECISION_META) as DecisionKind[]
                  ).map((kind) => (
                    <DropdownMenuItem
                      key={kind}
                      onClick={() => setDecideKind(kind)}
                    >
                      {DECISION_META[kind].label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          <div className="mt-2">
            <VersionThread
              workspaceId={workspaceId}
              projectId={projectId}
              versionId={version.id}
              onChanged={onChanged}
            />
          </div>

          {decideKind && (
            <DecideDialog
              kind={decideKind}
              busy={busy}
              onClose={() => setDecideKind(null)}
              onConfirm={(comment) => {
                void run(() =>
                  decideVersionFn({
                    data: {
                      workspaceId,
                      projectId,
                      versionId: version.id,
                      decision: decideKind,
                      comment: comment.length > 0 ? comment : undefined,
                    },
                  })
                ).then(() => setDecideKind(null))
              }}
            />
          )}
        </div>
      )}
    </li>
  )
}

function DecideDialog({
  kind,
  busy,
  onClose,
  onConfirm,
}: {
  kind: DecisionKind
  busy: boolean
  onClose: () => void
  onConfirm: (comment: string) => void
}) {
  const [comment, setComment] = useState("")
  const meta = DECISION_META[kind]

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{meta.label}</DialogTitle>
          <DialogDescription>{meta.description}</DialogDescription>
        </DialogHeader>
        <Textarea
          aria-label="Decision note (optional)"
          rows={3}
          placeholder={
            kind === "changes_requested"
              ? "What should change? (optional)"
              : "Add a note with this decision (optional)"
          }
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          maxLength={2000}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy} onClick={() => onConfirm(comment.trim())}>
            {meta.label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
