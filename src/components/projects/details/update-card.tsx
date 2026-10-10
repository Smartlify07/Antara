import { useMutation, useQueryClient } from "@tanstack/react-query"
import { formatDistanceToNow } from "date-fns"
import { CheckIcon, Loader2, RotateCcwIcon } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { formatBytes } from "@/components/projects/cloudinary-assets"
import { reviewProjectUpdateFn } from "@/server/functions/projects"
import { projectKeys } from "@/lib/queries/projects"
import { avatarTint } from "@/lib/avatar-tint"
import { cn } from "@/lib/utils"
import type { ProjectUpdateItem } from "@/server/services/project-update-service"

const REVIEW_META = {
  // Only progress updates reach this map; a comment has no review status at
  // all. `pending` has a blank label deliberately — "awaiting review" on a
  // card whose approve button sits right below it states the obvious, and the
  // controls already make the pending state actionable.
  pending: {
    label: "",
    className: "bg-muted text-muted-foreground",
  },
  approved: {
    label: "Approved",
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  changes_requested: {
    label: "Changes requested",
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
} as const

/**
 * One post in the feed — a comment or a progress update — with the files it
 * carried.
 *
 * Only a progress update is reviewable, so only a progress update renders a
 * status badge or the approve / request-changes controls. `reviewStatus` is null
 * on a comment, which is what the branch below keys off; the service enforces
 * the same rule on write, so this is presentation rather than the guard.
 *
 * The review decision is optimistic: the badge flips immediately and the
 * buttons disable, then the write settles. `onSettled` refetches the feed
 * regardless, so the server's record always wins.
 */
export function UpdateCard({
  update,
  workspaceId,
  projectId,
  canReview,
}: {
  update: ProjectUpdateItem & { optimistic?: boolean }
  workspaceId: string
  projectId: string
  canReview: boolean
}) {
  const client = useQueryClient()
  const updatesKey = projectKeys.updates(workspaceId, projectId)
  const pending = "optimistic" in update

  // Only progress updates are reviewed. A comment has `reviewStatus: null` and
  // gets no badge and no controls at all.
  const reviewable = update.kind === "progress_update"
  const meta =
    reviewable && update.reviewStatus ? REVIEW_META[update.reviewStatus] : null

  // Optimistic: the badge flips the moment a decision is clicked, and reverts
  // only this row on failure rather than restoring a whole-list snapshot — a
  // feed that refetched mid-flight should not have someone else's post
  // reverted along with it.
  const review = useMutation({
    mutationFn: (decision: "approved" | "changes_requested") =>
      reviewProjectUpdateFn({
        data: { workspaceId, projectId, updateId: update.id, decision },
      }),
    onMutate: async (decision) => {
      await client.cancelQueries({ queryKey: updatesKey })
      const previous = update.reviewStatus
      client.setQueryData<ProjectUpdateItem[]>(updatesKey, (current = []) =>
        current.map((row) =>
          row.id === update.id ? { ...row, reviewStatus: decision } : row
        )
      )
      return { previous }
    },
    onError: (_error, _decision, context) => {
      const previous = context?.previous
      if (!previous) return
      client.setQueryData<ProjectUpdateItem[]>(updatesKey, (current = []) =>
        current.map((row) =>
          row.id === update.id ? { ...row, reviewStatus: previous } : row
        )
      )
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: updatesKey })
    },
  })

  const name = update.author.name ?? update.author.email ?? "Someone"

  return (
    <article
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4",
        // A placeholder has no server record yet, so it is dimmed to read as
        // in-flight rather than as a real submission.
        pending && "opacity-60"
      )}
    >
      <header className="flex items-center gap-2">
        <Avatar className="size-6">
          {update.author.image ? (
            <AvatarImage src={update.author.image} alt="" />
          ) : null}
          <AvatarFallback
            className={`text-[10px] ${avatarTint(update.author.id || update.id)}`}
          >
            {name.charAt(0).toUpperCase() || "?"}
          </AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium">{name}</span>
            {update.kind === "progress_update" && (
              <span className="shrink-0 rounded bg-muted px-1.5 py-px text-[10px] font-medium text-muted-foreground">
                Progress update
              </span>
            )}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(update.createdAt), {
              addSuffix: true,
            })}
          </span>
        </div>
        {/* Null for a comment, and blank while a review is pending — a badge that
            says nothing sits on every card doing nothing. */}
        {!pending && meta && meta.label && (
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
              meta.className
            )}
          >
            {meta.label}
          </span>
        )}
      </header>

      <p className="text-sm leading-relaxed whitespace-pre-wrap">
        {update.body}
      </p>

      {update.versions.length > 0 && (
        <ul className="flex flex-col gap-1">
          {update.versions.map((version) => (
            <li key={version.id}>
              <a
                href={version.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-accent"
              >
                {/* The label is the whole point of the versioning work — v1,
                    v2 — so it is rendered as a badge, not as part of the name. */}
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  {version.label}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {version.filename}
                </span>
                <span className="shrink-0 text-muted-foreground">
                  {formatBytes(version.sizeBytes)}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}

      {/* Gated on `reviewable` as well as the status: a comment's status is null so
          the second condition already excludes it, but relying on that alone
          would make the rule implicit. */}
      {reviewable && update.reviewNote && (
        <p className="rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
          {update.reviewNote}
        </p>
      )}

      {/* Suppressed while pending: there is no server row to review yet, so
          the buttons would be firing against an id that does not exist. */}
      {canReview &&
        reviewable &&
        update.reviewStatus === "pending" &&
        !pending && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={review.isPending}
              onClick={() => review.mutate("approved")}
            >
              {review.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <CheckIcon />
              )}
              Approve
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={review.isPending}
              onClick={() => review.mutate("changes_requested")}
            >
              <RotateCcwIcon />
              Request changes
            </Button>
          </div>
        )}
    </article>
  )
}
