import { Link } from "@tanstack/react-router"
import { formatDueDate, formatRelativeTime, isOverdue } from "@/lib/time"
import type { RequestListItem } from "@/server/services/request-service"
import { REQUEST_META } from "./request-meta"

/**
 * A line in the triage inbox. Two separate anchors live in here — the title
 * (this request's detail) and, once accepted, the linked project chip — so
 * the card root stays a plain div: nested anchors would be mangled by the
 * browser long before any router sees them.
 */
export function RequestCard({
  workspaceSlug,
  request,
}: {
  workspaceSlug: string
  request: RequestListItem
}) {
  const meta = REQUEST_META[request.triageStatus]
  const deadlineLive =
    request.triageStatus === "open" || request.triageStatus === "needs_info"
      ? request.desiredDeadline
      : null

  return (
    <div className="rounded-xl border bg-card p-4 transition-colors hover:border-ring/60">
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${meta.badgeClass}`}
        >
          {meta.label}
        </span>
        {request.priority && (
          <span className="text-xs text-muted-foreground capitalize">
            {request.priority}
          </span>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {formatRelativeTime(request.createdAt)}
        </span>
      </div>

      <Link
        to="/w/$workspaceSlug/requests/$requestId"
        params={{ workspaceSlug, requestId: request.id }}
        className="mt-2 block font-medium tracking-tight hover:underline"
      >
        {request.title}
      </Link>
      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
        {request.brief}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="flex size-5 items-center justify-center rounded-full bg-muted text-[10px] font-medium"
          >
            {(request.requesterName?.trim()[0] ?? "?").toUpperCase()}
          </span>
          {request.requesterName ?? "Former member"}
        </span>

        {request.category && <span>{request.category}</span>}

        {request.messageCount > 0 && (
          <span>
            {request.messageCount}{" "}
            {request.messageCount === 1 ? "message" : "messages"}
          </span>
        )}

        {deadlineLive && (
          <span
            className={
              isOverdue(deadlineLive)
                ? "font-medium text-destructive"
                : undefined
            }
          >
            wanted by {formatDueDate(deadlineLive)}
          </span>
        )}

        {request.linkedProjectId && request.linkedProjectSlug && (
          <Link
            to="/w/$workspaceSlug/projects/$projectSlug"
            params={{ workspaceSlug, projectSlug: request.linkedProjectSlug }}
            className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-1.5 py-0.5 font-medium text-emerald-700 hover:underline dark:bg-emerald-500/15 dark:text-emerald-300"
          >
            → {request.linkedProjectTitle ?? "Project"}
          </Link>
        )}
      </div>
    </div>
  )
}
