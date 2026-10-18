/**
 * Variant `duotone` — seeding scaffold for the lane. A two-stop diagonal
 * gradient whose hue comes from the triage state (the card's meaning),
 * seeded per request for angle variety; a dense chip row up top, a brief
 * excerpt anchored at the bottom.
 */
import type { RequestCardProps } from "../registry"
import { GRADIENT_TEXT, hashString } from "../card-gradient"
import { formatRelativeTime, isOverdue, formatDueDate } from "@/lib/time"
import { Link } from "@tanstack/react-router"
import { REQUEST_META } from "../../request-meta"
import type { CSSProperties } from "react"

/** State hue: the queue's vocabulary, not decoration. */
const STATE_HUE: Record<string, number> = {
  open: 205, // sky — fresh work
  needs_info: 40, // amber — waiting on someone
  accepted: 155, // emerald — going ahead
  declined: 250, // dim indigo — parked
}

export function RequestCard({ workspaceSlug, request, onOpen }: RequestCardProps) {
  const meta = REQUEST_META[request.triageStatus]
  const deadlineLive =
    request.triageStatus === "open" || request.triageStatus === "needs_info"
      ? request.desiredDeadline
      : null

  const hue = STATE_HUE[request.triageStatus] ?? 220
  const angle = 110 + (hashString(request.id) % 60) // 110–170° per request
  const artwork: CSSProperties = {
    backgroundImage: `linear-gradient(${angle}deg, hsl(${hue} 55% 26%) 0%, hsl(${(hue + 18) % 360} 45% 16%) 55%, hsl(${hue} 35% 10%) 100%)`,
  }

  return (
    <button
      type="button"
      onClick={() => onOpen(request.id)}
      className="group relative h-56 w-full overflow-hidden rounded-2xl text-left outline-none transition-transform duration-200 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div
        className="absolute inset-0 transition-transform duration-300 group-hover:scale-[1.04]"
        style={artwork}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />

      <div className="relative flex h-full flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${GRADIENT_TEXT.chip}`}>
            {meta.label}
          </span>
          {request.priority && (
            <span className={GRADIENT_TEXT.accent + " text-xs capitalize"}>
              {request.priority}
            </span>
          )}
          {request.category && (
            <span className={`text-xs ${GRADIENT_TEXT.muted}`}>{request.category}</span>
          )}
          <span className={`ml-auto text-xs ${GRADIENT_TEXT.muted}`}>
            {formatRelativeTime(request.createdAt)}
          </span>
        </div>

        <div className="mt-auto">
          <h3 className={`line-clamp-2 text-base leading-snug ${GRADIENT_TEXT.title}`}>
            {request.title}
          </h3>
          {request.brief && (
            <p className={`mt-1 line-clamp-2 text-[13px] leading-relaxed ${GRADIENT_TEXT.muted}`}>
              {request.brief}
            </p>
          )}
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className={`inline-flex items-center gap-1.5 ${GRADIENT_TEXT.meta}`}>
              <span
                aria-hidden
                className="flex size-4 items-center justify-center rounded-full bg-white/20 text-[10px] font-medium"
              >
                {(request.requesterName?.trim()[0] ?? "?").toUpperCase()}
              </span>
              {request.requesterName ?? "Former member"}
            </span>
            {request.messageCount > 0 && (
              <span className={GRADIENT_TEXT.meta}>
                {request.messageCount} {request.messageCount === 1 ? "message" : "messages"}
              </span>
            )}
            {deadlineLive && (
              <span
                className={
                  isOverdue(deadlineLive)
                    ? "font-medium text-rose-300"
                    : GRADIENT_TEXT.meta
                }
              >
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
