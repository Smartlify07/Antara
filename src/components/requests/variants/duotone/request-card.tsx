/**
 * Variant `duotone` — the state is the hue; the request is the geometry.
 * The artwork is a strict two-stop diagonal: a lit face and a deep recess
 * of one state hue (sky = open work, amber = needs info, emerald = accepted,
 * dim indigo = declined), with only sweep angle and a small saturation
 * drift seeded per request. The layout is dense and editorial: state chip
 * with a two-notch glyph up top, title mid-card, a tight meta line at the
 * floor. The brief excerpt shows only when the title leaves room — one
 * deterministic rule, so cards never flicker between noisy and sparse.
 */
import type { RequestCardProps } from "../registry"
import { GRADIENT_SCRIM_CLASS, GRADIENT_TEXT } from "../card-gradient"
import { formatDueDate, formatRelativeTime, isOverdue } from "@/lib/time"
import { Link } from "@tanstack/react-router"
import { REQUEST_META } from "../../request-meta"
import { duotoneGradient, stateAccentCss } from "./state-palette"
import { hasBriefRoom, messagesLabel, requesterInitial } from "./card-text"

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

  return (
    <button
      type="button"
      onClick={() => onOpen(request.id)}
      className="group relative h-56 w-full overflow-hidden rounded-2xl text-left ring-1 ring-white/10 transition-transform duration-200 outline-none ring-inset hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div
        className="absolute inset-0 transition-transform duration-300 group-hover:scale-[1.03]"
        style={duotoneGradient(request)}
      />
      <div className={GRADIENT_SCRIM_CLASS} />

      <div className="relative flex h-full flex-col p-4">
        {/* State + priority + category + age: the queue's vocabulary, one row. */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium whitespace-nowrap ${GRADIENT_TEXT.chip}`}
          >
            <span
              aria-hidden
              className="mr-1.5 inline-flex items-end gap-[2px]"
            >
              <span
                className="h-[7px] w-[3px] rounded-[1px]"
                style={{
                  backgroundColor: stateAccentCss(request.triageStatus),
                }}
              />
              <span className="h-1 w-[3px] rounded-[1px] bg-white/50" />
            </span>
            {meta.label}
          </span>
          {request.priority === "urgent" ? (
            <span className="rounded-md bg-rose-400/20 px-1.5 py-0.5 text-[10px] font-semibold tracking-widest text-rose-50 uppercase ring-1 ring-rose-300/40">
              urgent
            </span>
          ) : request.priority ? (
            <span
              className={`whitespace-nowrap capitalize ${GRADIENT_TEXT.muted}`}
            >
              {request.priority}
            </span>
          ) : null}
          {request.category && (
            <span className={`max-w-28 truncate ${GRADIENT_TEXT.muted}`}>
              {request.category}
            </span>
          )}
          <span className={`ml-auto shrink-0 ${GRADIENT_TEXT.muted}`}>
            {formatRelativeTime(request.createdAt)}
          </span>
        </div>

        {/* Title mid-card; the brief excerpt only fills room the title spares. */}
        <div className="my-auto">
          <h3
            className={`line-clamp-2 text-lg leading-tight ${GRADIENT_TEXT.title}`}
          >
            {request.title}
          </h3>
          {hasBriefRoom(request.title) && (
            <p
              className={`mt-1.5 line-clamp-2 text-[13px] leading-relaxed ${GRADIENT_TEXT.muted}`}
            >
              {request.brief}
            </p>
          )}
        </div>

        {/* Tight meta line: requester, thread weight, deadline, project. */}
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <span
              aria-hidden
              className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white/15 text-[10px] font-medium text-white/90"
            >
              {requesterInitial(request.requesterName)}
            </span>
            <span className={`truncate ${GRADIENT_TEXT.meta}`}>
              {request.requesterName ?? "Former member"}
            </span>
          </span>
          {request.messageCount > 0 && (
            <span className={`shrink-0 ${GRADIENT_TEXT.muted}`}>
              {messagesLabel(request.messageCount)}
            </span>
          )}
          {deadlineLive && (
            <span
              className={`shrink-0 ${
                isOverdue(deadlineLive)
                  ? "font-medium text-rose-200"
                  : GRADIENT_TEXT.meta
              }`}
            >
              wanted by {formatDueDate(deadlineLive)}
            </span>
          )}
          {request.linkedProjectId && request.linkedProjectSlug && (
            <Link
              to="/w/$workspaceSlug/projects/$projectSlug"
              params={{ workspaceSlug, projectSlug: request.linkedProjectSlug }}
              onClick={(e) => e.stopPropagation()}
              className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-md bg-white/10 px-1.5 py-0.5 font-medium whitespace-nowrap text-white ring-1 ring-white/20 hover:bg-white/20"
            >
              → {request.linkedProjectTitle ?? "Project"}
            </Link>
          )}
        </div>
      </div>
    </button>
  )
}
