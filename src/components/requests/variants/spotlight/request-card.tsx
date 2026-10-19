/**
 * Variant `spotlight` — the stage card.
 *
 * A lamp is aimed at each request: the id seeds the beam's hue, position,
 * and reach, while the room around it falls to near-black. The title is the
 * subject — oversized, pressed into the light with a whisper of glow — and
 * everything else steps back: a quiet status chip with a state-lamp dot, a
 * stamped priority plate, and a hushed footer. Urgency has one home on the
 * card: rose, and only rose — the artwork itself never paints that band.
 */
import type { RequestCardProps } from "../registry"
import { formatDueDate, formatRelativeTime, isOverdue } from "@/lib/time"
import { Link } from "@tanstack/react-router"
import { REQUEST_META } from "../../request-meta"
import type { RequestTriageStatus } from "@/db/enums"
import type { CSSProperties } from "react"
import {
  SPOTLIGHT_GRAIN,
  isDueEmphasis,
  messageLabel,
  spotlightArtwork,
  spotlightSeed,
} from "./spotlight-art"

/**
 * State lamp dots for the dark chip (REQUEST_META.badgeClass targets light
 * surfaces — these stay legible over near-black). Glow keeps the lamp lit.
 */
const STATUS_DOT: Record<RequestTriageStatus, string> = {
  open: "bg-sky-400 shadow-[0_0_6px] shadow-sky-400/60",
  needs_info: "bg-amber-300 shadow-[0_0_6px] shadow-amber-300/60",
  accepted: "bg-emerald-400 shadow-[0_0_6px] shadow-emerald-400/60",
  declined: "bg-white/35",
}

/** Letterpress-in-reverse: a dark under-edge plus a whisper of bloom. */
const TITLE_PRESS: CSSProperties = {
  textShadow:
    "0 1px 1px rgba(0, 0, 0, 0.42), 0 0 24px rgba(255, 255, 255, 0.14)",
}

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
  // Calm rose: reserved for deadlines that are late or stamped urgent.
  const dueHot = isDueEmphasis(deadlineLive, request.priority)

  return (
    <button
      type="button"
      onClick={() => onOpen(request.id)}
      className="group relative h-56 w-full overflow-hidden rounded-2xl text-left transition-[transform,box-shadow] duration-200 outline-none hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* The rig: beam, core, pit, bounce, counter-glow, vignette. */}
      <div
        aria-hidden
        className="absolute inset-0 transition-transform duration-500 ease-out group-hover:scale-[1.045]"
        style={spotlightArtwork(spotlightSeed(request.id))}
      />
      <div aria-hidden className="absolute inset-0" style={SPOTLIGHT_GRAIN} />
      {/* Scrim for the bottom row and the upper chip band. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-black/30"
      />

      <div className="relative flex h-full flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/30 px-2 py-0.5 text-[11px] font-medium text-white/85 ring-1 ring-white/15 backdrop-blur-[2px] ring-inset">
            <span
              aria-hidden
              className={`size-1.5 rounded-full ${STATUS_DOT[request.triageStatus]}`}
            />
            {meta.label}
          </span>
          {request.priority && (
            <span className="rounded-[3px] bg-white/90 px-1.5 py-0.5 text-[10px] leading-none font-bold tracking-[0.2em] text-neutral-900 uppercase shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
              {request.priority}
            </span>
          )}
        </div>

        {/* The subject, pressed into the light. */}
        <h3
          className="mt-4 line-clamp-2 text-[22px] leading-[1.15] font-semibold tracking-[-0.02em] text-white"
          style={TITLE_PRESS}
        >
          {request.title}
        </h3>
        {request.category && (
          <p className="mt-2 text-[10px] font-medium tracking-[0.22em] text-white/55 uppercase">
            {request.category}
          </p>
        )}
        {request.messageCount > 0 && (
          <p className="mt-1 text-[11px] text-white/60 tabular-nums">
            {messageLabel(request.messageCount)}
          </p>
        )}

        {request.linkedProjectId && request.linkedProjectSlug && (
          <Link
            to="/w/$workspaceSlug/projects/$projectSlug"
            params={{ workspaceSlug, projectSlug: request.linkedProjectSlug }}
            onClick={(e) => e.stopPropagation()}
            className="mt-2 inline-flex w-fit max-w-full items-center gap-1 rounded-md bg-white/10 px-1.5 py-0.5 text-[11px] font-medium text-white/85 ring-1 ring-white/15 backdrop-blur-[2px] transition-colors ring-inset hover:bg-white/20 focus-visible:outline-none"
          >
            <span aria-hidden>→</span>
            <span className="min-w-0 truncate">
              {request.linkedProjectTitle ?? "Project"}
            </span>
          </Link>
        )}

        {/* Hushed footer: the quiet facts, the last thing the eye keeps. */}
        <div className="mt-auto flex items-center gap-2 border-t border-white/10 pt-2.5">
          <span
            aria-hidden
            className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white/15 text-[10px] font-semibold text-white ring-1 ring-white/25 ring-inset"
          >
            {(request.requesterName?.trim()[0] ?? "?").toUpperCase()}
          </span>
          <span className="min-w-0 flex-1 truncate text-xs text-white/80">
            {request.requesterName ?? "Former member"}
          </span>
          <span className="shrink-0 text-[11px] text-white/50">
            {formatRelativeTime(request.createdAt)}
          </span>
          {deadlineLive && (
            <span
              className={`shrink-0 text-[11px] ${
                dueHot
                  ? isOverdue(deadlineLive)
                    ? "font-medium text-rose-300"
                    : "text-rose-300/90"
                  : "text-white/75"
              }`}
            >
              due {formatDueDate(deadlineLive)}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
