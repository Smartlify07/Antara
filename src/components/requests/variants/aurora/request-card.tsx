/**
 * Variant `aurora` — a per-request night sky. Layered CSS gradients: a
 * luminous curtain and a quiet counter-glow over a dark indigo base
 * (see `palette.ts` for the pure system and its tests). The title is the
 * hero, floating mid-card; the metadata row keeps to the bottom edge,
 * quiet and white-based, with the urgent chip the only raised voice.
 */
import type { RequestCardProps } from "../registry"
import { GRADIENT_SCRIM_CLASS, GRADIENT_TEXT } from "../card-gradient"
import {
  auroraSky,
  auroraStatusChipClass,
  AURORA_CHIP_NEUTRAL,
  AURORA_URGENT_CHIP_CLASS,
} from "./palette"
import { formatDueDate, formatRelativeTime, isOverdue } from "@/lib/time"
import { Link } from "@tanstack/react-router"
import { REQUEST_META } from "../../request-meta"

export function RequestCard({
  workspaceSlug,
  request,
  onOpen,
}: RequestCardProps) {
  const meta = REQUEST_META[request.triageStatus]
  const deadlineLive =
    request.triageStatus === "open" || request.triageStatus === "needs_info"
      ? request.desiredDeadline
      : null
  const urgent = request.priority === "urgent"

  return (
    <button
      type="button"
      onClick={() => onOpen(request.id)}
      className="group relative h-56 w-full overflow-hidden rounded-2xl text-left transition-[transform,box-shadow] duration-200 outline-none hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/25 focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* Sky: curtain + counter-glow over a dark indigo base. */}
      <div
        aria-hidden
        className="absolute inset-0 transition-transform duration-500 ease-out group-hover:scale-[1.04]"
        style={auroraSky(request)}
      />
      <div className={GRADIENT_SCRIM_CLASS} />

      <div className="relative flex h-full flex-col p-4">
        {/* Chip row: status + category left, urgent (if any) right. */}
        <div className="flex items-start gap-1.5">
          <span className={auroraStatusChipClass(request.triageStatus)}>
            {meta.label}
          </span>
          {request.category && (
            <span
              className={`${AURORA_CHIP_NEUTRAL} max-w-[11ch] shrink-0 truncate`}
            >
              {request.category}
            </span>
          )}
          {urgent && (
            <span className={`ml-auto shrink-0 ${AURORA_URGENT_CHIP_CLASS}`}>
              urgent
            </span>
          )}
        </div>

        {/* Hero zone: the title, with a hairline start-marker above it. */}
        <div className="mt-3 min-w-0">
          <span
            aria-hidden
            className="mb-2 block h-px w-9 rounded-full bg-gradient-to-r from-white/60 via-white/25 to-transparent"
          />
          <h3
            className={`line-clamp-2 text-lg leading-tight ${GRADIENT_TEXT.title}`}
          >
            {request.title}
          </h3>
          <p
            className={`mt-1.5 line-clamp-2 text-[13px] leading-relaxed ${GRADIENT_TEXT.muted}`}
          >
            {request.brief}
          </p>
        </div>

        {/* Footer: quiet metadata pinned to the bottom edge. */}
        <div className="mt-auto flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <span
              aria-hidden
              className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white/20 text-[10px] font-medium text-white"
            >
              {(request.requesterName?.trim()[0] ?? "?").toUpperCase()}
            </span>
            <span className={`max-w-[10ch] truncate ${GRADIENT_TEXT.meta}`}>
              {request.requesterName ?? "Former member"}
            </span>
          </span>
          {request.messageCount > 0 && (
            <span className={GRADIENT_TEXT.meta}>
              {request.messageCount}{" "}
              {request.messageCount === 1 ? "message" : "messages"}
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
          <span
            className={`ml-auto shrink-0 text-[11px] ${GRADIENT_TEXT.muted}`}
          >
            {formatRelativeTime(request.createdAt)}
          </span>
        </div>
      </div>
    </button>
  )
}
