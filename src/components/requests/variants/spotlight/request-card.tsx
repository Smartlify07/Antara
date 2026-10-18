/**
 * Variant `spotlight` — seeding scaffold for the lane. A radial spotlight
 * with a dark vignette; the title oversized and pressed toward the light,
 * priority as a stamped corner marker, the requester row as a footer.
 */
import type { RequestCardProps } from "../registry"
import { GRADIENT_TEXT, hashString } from "../card-gradient"
import { formatDueDate, formatRelativeTime, isOverdue } from "@/lib/time"
import { Link } from "@tanstack/react-router"
import { REQUEST_META } from "../../request-meta"
import type { CSSProperties } from "react"

export function RequestCard({ workspaceSlug, request, onOpen }: RequestCardProps) {
  const meta = REQUEST_META[request.triageStatus]
  const deadlineLive =
    request.triageStatus === "open" || request.triageStatus === "needs_info"
      ? request.desiredDeadline
      : null

  // Warm spotlight drifting with the request's seed, over near-black.
  const hue = 30 + (hashString(request.id) % 300)
  const artwork: CSSProperties = {
    backgroundImage: `radial-gradient(120% 90% at 18% 12%, hsl(${hue} 50% 32%) 0%, hsl(${(hue + 40) % 360} 40% 16%) 45%, hsl(240 25% 8%) 100%)`,
  }

  return (
    <button
      type="button"
      onClick={() => onOpen(request.id)}
      className="group relative h-56 w-full overflow-hidden rounded-2xl text-left outline-none transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div
        className="absolute inset-0 transition-transform duration-300 group-hover:scale-[1.06]"
        style={artwork}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20" />

      <div className="relative flex h-full flex-col justify-between p-4">
        <div className="flex items-start justify-between gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${GRADIENT_TEXT.chip}`}>
            {meta.label}
          </span>
          {request.priority && (
            <span
              aria-label={`${request.priority} priority`}
              className="rounded-md bg-white/85 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-900"
            >
              {request.priority}
            </span>
          )}
        </div>

        <div>
          <h3 className={`line-clamp-2 text-lg leading-tight ${GRADIENT_TEXT.title}`}>
            {request.title}
          </h3>
          {request.category && (
            <span className={`mt-1 block text-xs ${GRADIENT_TEXT.muted}`}>
              {request.category}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-white/15 pt-2.5">
          <span
            aria-hidden
            className="flex size-5 items-center justify-center rounded-full bg-white/20 text-[10px] font-medium text-white"
          >
            {(request.requesterName?.trim()[0] ?? "?").toUpperCase()}
          </span>
          <span className={`truncate text-xs ${GRADIENT_TEXT.meta}`}>
            {request.requesterName ?? "Former member"}
          </span>
          <span className={`ml-auto shrink-0 text-xs ${GRADIENT_TEXT.muted}`}>
            {formatRelativeTime(request.createdAt)}
          </span>
          {deadlineLive && (
            <span
              className={`shrink-0 text-xs ${
                isOverdue(deadlineLive) ? "font-medium text-rose-300" : GRADIENT_TEXT.meta
              }`}
            >
              {formatDueDate(deadlineLive)}
            </span>
          )}
        </div>

        {request.linkedProjectId && request.linkedProjectSlug && (
          <Link
            to="/w/$workspaceSlug/projects/$projectSlug"
            params={{ workspaceSlug, projectSlug: request.linkedProjectSlug }}
            onClick={(e) => e.stopPropagation()}
            className="mt-2 inline-flex w-fit items-center gap-1 rounded-md bg-emerald-500/25 px-1.5 py-0.5 text-xs font-medium text-white ring-1 ring-white/25 hover:bg-emerald-500/35"
          >
            → {request.linkedProjectTitle ?? "Project"}
          </Link>
        )}
      </div>
    </button>
  )
}
