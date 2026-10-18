/**
 * Variant `aurora` — seeding scaffold for the lane. A soft multi-stop aurora
 * sweep seeded per request; the title large and low on the card, the
 * metadata row pinned to the bottom edge.
 */
import type { RequestCardProps } from "../registry"
import { GRADIENT_SCRIM_CLASS, GRADIENT_TEXT, requestGradient } from "../card-gradient"
import { formatDueDate, formatRelativeTime, isOverdue } from "@/lib/time"
import { Link } from "@tanstack/react-router"
import { REQUEST_META } from "../../request-meta"

export function RequestCard({ workspaceSlug, request, onOpen }: RequestCardProps) {
  const meta = REQUEST_META[request.triageStatus]
  const deadlineLive =
    request.triageStatus === "open" || request.triageStatus === "needs_info"
      ? request.desiredDeadline
      : null

  return (
    <button
      type="button"
      onClick={() => onOpen(request.id)}
      className="group relative h-56 w-full overflow-hidden rounded-2xl text-left outline-none transition-transform duration-200 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="absolute inset-0 transition-transform duration-300 group-hover:scale-[1.03]" style={requestGradient(request)} />
      <div className={GRADIENT_SCRIM_CLASS} />

      <div className="relative flex h-full flex-col justify-between p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${GRADIENT_TEXT.chip}`}>
            {meta.label}
          </span>
          {request.priority === "urgent" && (
            <span className={`rounded-full px-2 py-0.5 text-xs ${GRADIENT_TEXT.urgent}`}>urgent</span>
          )}
        </div>

        <div>
          <h3 className={`line-clamp-2 text-base leading-snug ${GRADIENT_TEXT.title}`}>
            {request.title}
          </h3>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className={GRADIENT_TEXT.meta}>{formatRelativeTime(request.createdAt)}</span>
            <span className="inline-flex items-center gap-1">
              <span
                aria-hidden
                className="flex size-4 items-center justify-center rounded-full bg-white/20 text-[10px] font-medium"
              >
                {(request.requesterName?.trim()[0] ?? "?").toUpperCase()}
              </span>
              <span className={GRADIENT_TEXT.meta}>
                {request.requesterName ?? "Former member"}
              </span>
            </span>
            {request.category && (
              <span className={GRADIENT_TEXT.meta}>{request.category}</span>
            )}
            {request.messageCount > 0 && (
              <span className={GRADIENT_TEXT.meta}>
                {request.messageCount} {request.messageCount === 1 ? "message" : "messages"}
              </span>
            )}
            {deadlineLive && (
              <span className={isOverdue(deadlineLive) ? "font-medium text-rose-300" : GRADIENT_TEXT.meta}>
                wanted by {formatDueDate(deadlineLive)}
              </span>
            )}
            {request.linkedProjectId && request.linkedProjectSlug && (
              <Link
                to="/w/$workspaceSlug/projects/$projectSlug"
                params={{ workspaceSlug, projectSlug: request.linkedProjectSlug }}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 rounded-md bg-emerald-500/25 px-1.5 py-0.5 font-medium text-white ring-1 ring-white/25 hover:bg-emerald-500/35"
              >
                → {request.linkedProjectTitle ?? "Project"}
              </Link>
            )}
          </p>
        </div>
      </div>
    </button>
  )
}
