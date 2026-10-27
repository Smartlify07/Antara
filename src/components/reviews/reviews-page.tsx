import { useQuery } from "@tanstack/react-query"
import { AppLoading } from "@/components/app-loading"
import { reviewQueueBadgeQuery, reviewQueueQuery } from "@/lib/queries/versions"
import { ReviewRow } from "./review-row"

/**
 * The Reviews queue (FR-030): every submitted version across the projects
 * this viewer may decide in, stalest submission first. Authority comes from
 * the server's badge fact — non-reviewers get the honest reason, not an
 * empty grid that implies "caught up". The decision happens ON the row
 * (see `ReviewRow`); "Open project" stays for the deep path — the version's
 * thread, the deliverable's context.
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
            <ReviewRow
              key={row.versionId}
              row={row}
              workspaceId={workspaceId}
              workspaceSlug={workspaceSlug}
            />
          ))}
        </ol>
      )}
    </div>
  )
}
