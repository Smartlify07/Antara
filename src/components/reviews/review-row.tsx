import { useState } from "react"
import { Link } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { useDecideVersion } from "@/lib/queries/versions"
import { formatRelativeTime } from "@/lib/time"
import { REVIEW_STATUS_META } from "@/components/projects/details/deliverables/version-meta"
import type { DecisionKind } from "@/components/projects/details/deliverables/version-meta"
import { DecideDialog } from "@/components/projects/details/deliverables/decide-dialog"
import type { ReviewQueueRow } from "@/server/services/version-service"

/**
 * One Reviews queue row, with the decision ON it — the landing page's review
 * panel, made real. Every row the queue shows is already authority-filtered
 * server-side (admins see the workspace's submissions, leads their own
 * projects'), so the buttons render on all rows and the service re-guards
 * the write.
 *
 * Both decisions confirm through the dialog: `approved` is terminal for user
 * actions — only the next version's submission supersedes it — so the confirm
 * step is the guard against an irreversible mis-click, and the optional note
 * rides along.
 */
export function ReviewRow({
  row,
  workspaceId,
  workspaceSlug,
}: {
  row: ReviewQueueRow
  workspaceId: string
  workspaceSlug: string
}) {
  const [decideKind, setDecideKind] = useState<DecisionKind | null>(null)
  const decide = useDecideVersion(workspaceId)
  const meta = REVIEW_STATUS_META.submitted

  return (
    <li className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start gap-2">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${meta.badgeClass}`}
        >
          {meta.label}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium tracking-tight">
            {row.filename}
            <span className="ml-2 font-mono text-xs text-muted-foreground">
              {row.label}
            </span>
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {row.projectTitle}
            {row.deliverableTitle ? ` · ${row.deliverableTitle}` : ""}
            {" · submitted by "}
            {row.submitterName ?? row.submitterEmail ?? "a former member"}
            {row.submittedAt ? ` · ${formatRelativeTime(row.submittedAt)}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            disabled={decide.isPending}
            onClick={() => setDecideKind("approved")}
          >
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={decide.isPending}
            onClick={() => setDecideKind("changes_requested")}
          >
            Request changes
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link
              to="/w/$workspaceSlug/projects/$projectSlug"
              params={{ workspaceSlug, projectSlug: row.projectSlug }}
            >
              Open project
            </Link>
          </Button>
        </div>
      </div>

      {decide.isError && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {decide.error instanceof Error
            ? decide.error.message
            : "Could not record the decision."}
        </p>
      )}

      {decideKind && (
        <DecideDialog
          kind={decideKind}
          busy={decide.isPending}
          onClose={() => setDecideKind(null)}
          onConfirm={(comment) =>
            decide.mutate(
              {
                projectId: row.projectId,
                versionId: row.versionId,
                decision: decideKind,
                comment,
              },
              { onSettled: () => setDecideKind(null) }
            )
          }
        />
      )}
    </li>
  )
}
