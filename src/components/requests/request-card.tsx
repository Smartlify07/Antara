import { Link } from "@tanstack/react-router"
import {
  CalendarIcon,
  ChevronRightIcon,
  MessageSquareIcon,
  PenLineIcon,
  TagIcon,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { formatDueDate, formatRelativeTime, isOverdue } from "@/lib/time"
import type { RequestListItem } from "@/server/services/request-service"
import { REQUEST_META } from "./request-meta"
import { coverGradientStyle } from "./gradient-recipes"

/**
 * A request card in the intake grid: the system's white card with one
 * gradient cover across the top — the only colour on an otherwise monochrome
 * surface — and title + metadata below it, iconed because words are chrome.
 *
 * The whole card opens the detail dialog in place (no routing, no detail
 * fetch): a stretched button covers the card, and the only interactive
 * element inside it — the linked-project chip, once accepted — sits above
 * that button in stacking order.
 */
export function RequestCard({
  workspaceSlug,
  request,
  onOpen,
}: {
  workspaceSlug: string
  request: RequestListItem
  onOpen: (requestId: string) => void
}) {
  const meta = REQUEST_META[request.triageStatus]
  const deadlineLive =
    request.triageStatus === "open" || request.triageStatus === "needs_info"
      ? request.desiredDeadline
      : null
  const deadlineOverdue = deadlineLive !== null && isOverdue(deadlineLive)

  return (
    <Card className="relative gap-0 py-0 transition-colors duration-150 focus-within:ring-2 focus-within:ring-ring hover:ring-foreground/20">
      {/* Stretched open affordance: the card IS the button. */}
      <button
        type="button"
        onClick={() => onOpen(request.id)}
        aria-label={`Open request: ${request.title}`}
        className="absolute inset-0 rounded-xl outline-none"
      />

      <div
        aria-hidden
        className="h-32 w-full rounded-t-xl"
        style={coverGradientStyle(request.id)}
      />

      <CardContent className="flex flex-col gap-3 px-4 pt-3 pb-4">
        <h3 className="line-clamp-2 font-heading text-base leading-snug font-medium text-card-foreground">
          {request.title}
        </h3>

        <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
          <span
            className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${meta.badgeClass}`}
          >
            {meta.label}
          </span>

          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5">
            {request.priority && (
              <span className="inline-flex items-center gap-1 capitalize">
                {request.priority} priority
              </span>
            )}
            {request.category && (
              <span className="inline-flex items-center gap-1">
                <TagIcon aria-hidden className="size-3.5 shrink-0" />
                {request.category}
              </span>
            )}
            {deadlineLive && (
              <span
                className={
                  deadlineOverdue
                    ? "inline-flex items-center gap-1 font-medium text-destructive"
                    : "inline-flex items-center gap-1"
                }
              >
                <CalendarIcon aria-hidden className="size-3.5 shrink-0" />
                wanted by {formatDueDate(deadlineLive)}
              </span>
            )}
            {request.messageCount > 0 && (
              <span className="inline-flex items-center gap-1">
                <MessageSquareIcon aria-hidden className="size-3.5 shrink-0" />
                {request.messageCount}
              </span>
            )}
          </div>

          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="flex size-4 items-center overflow-hidden rounded-full bg-muted text-[9px] font-medium"
            >
              {request.requesterImage ? (
                <img
                  src={request.requesterImage}
                  alt=""
                  className="size-4 object-cover"
                />
              ) : (
                (request.requesterName?.trim()[0] ?? "?").toUpperCase()
              )}
            </span>
            {request.requesterName ?? "Former member"}
            <span aria-hidden className="text-foreground/30">
              ·
            </span>
            <span>{formatRelativeTime(request.createdAt)}</span>
          </span>
        </div>

        <span
          aria-hidden
          className="inline-flex w-fit items-center gap-1 text-xs font-medium text-foreground/60"
        >
          <PenLineIcon className="size-3.5" />
          Open request
          <ChevronRightIcon className="size-3.5" />
        </span>
      </CardContent>

      {request.linkedProjectId && request.linkedProjectSlug && (
        <Link
          to="/w/$workspaceSlug/projects/$projectSlug"
          params={{ workspaceSlug, projectSlug: request.linkedProjectSlug }}
          className="absolute right-3 bottom-3 z-10 inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700 hover:underline dark:bg-emerald-500/15 dark:text-emerald-300"
        >
          → {request.linkedProjectTitle ?? "Project"}
        </Link>
      )}
    </Card>
  )
}
