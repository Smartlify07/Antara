import { Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { AppLoading } from "@/components/app-loading"
import { REVIEW_STATUS_META } from "@/components/projects/details/deliverables/version-meta"
import { reviewQueueBadgeQuery, reviewQueueQuery } from "@/lib/queries/versions"
import { Button } from "@/components/ui/button"
import { formatRelativeTime } from "@/lib/time"

/**
 * The Reviews queue (FR-030): every submitted version across the projects
 * this viewer may decide in, stalest submission first. Authority comes from
 * the server's badge fact — non-reviewers get the honest reason, not an
 * empty grid that implies "caught up".
 */
export function ReviewsPage({
  workspaceSlug,
  workspaceId,
}: {
  workspaceSlug: string
  workspaceId: string
}) {
  const { data: badge, isPending: badgePending } = useQuery(
    reviewQueueBadgeQuery(workspaceSlug)
  )
  const {
    data: rows = [],
    isPending,
    error,
  } = useQuery(reviewQueueQuery(workspaceId))

  const meta = REVIEW_STATUS_META.submitted

  // One arrival: the deny note and the queue both read viewer authority, so
  // the page can't state one while guessing the other — both queries settle,
  // then the whole page paints; the shell's pulsing logo covers the fetch.
  if (badgePending || isPending) return <AppLoading />

  if (badge && !badge.canReview) {
    return (
      <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        Submitted versions are reviewed by project leads and workspace admins.
        You will see this queue when you lead work.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">Reviews</h1>
        <p className="text-sm text-muted-foreground">
          Versions waiting for a decision, oldest request first. Approving ties
          the decision to that exact version.
        </p>
      </header>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Could not load the queue."}
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nothing is waiting for review.
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {rows.map((row) => (
            <li key={row.versionId} className="rounded-xl border bg-card p-4">
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
                    {row.submitterName ??
                      row.submitterEmail ??
                      "a former member"}
                    {row.submittedAt
                      ? ` · ${formatRelativeTime(row.submittedAt)}`
                      : ""}
                  </p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link
                    to="/w/$workspaceSlug/projects/$projectSlug"
                    params={{
                      workspaceSlug,
                      projectSlug: row.projectSlug,
                    }}
                  >
                    Open project
                  </Link>
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
