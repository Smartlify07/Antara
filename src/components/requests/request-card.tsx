import {
  CalendarIcon,
  CircleCheckIcon,
  CircleHelpIcon,
  CircleIcon,
  CircleXIcon,
  FlagIcon,
  InboxIcon,
  MessageSquareIcon,
  TagIcon,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { formatDueDate, formatRelativeTime, isOverdue } from "@/lib/time"
import { REQUEST_META } from "./request-meta"
import type { RequestListItem } from "@/server/services/request-service"
import type { RequestTriageStatus } from "@/db/enums"

/**
 * State icon + icon tint for the meta row. Labels stay plain muted text —
 * the icon carries the state the way Linear's issue icons do.
 */
const STATE_META: Record<
  RequestTriageStatus,
  { Icon: typeof CircleIcon; iconClass: string }
> = {
  open: { Icon: CircleIcon, iconClass: "text-sky-600" },
  needs_info: { Icon: CircleHelpIcon, iconClass: "text-amber-600" },
  accepted: { Icon: CircleCheckIcon, iconClass: "text-emerald-600" },
  declined: { Icon: CircleXIcon, iconClass: "text-muted-foreground" },
}

/**
 * A request card in the intake grid, in the reviewed style: compact white
 * card, the title inside a slightly rounded badge with a request icon,
 * metadata right underneath it, and the requester's avatar pushed to the
 * far right of that row (justify-between). No gradients anywhere.
 *
 * The whole card opens the detail dialog in place — a stretched button
 * covers the card so clicking anywhere opens the modal immediately.
 */
export function RequestCard({
  request,
  onOpen,
}: {
  workspaceSlug: string
  request: RequestListItem
  onOpen: (requestId: string) => void
}) {
  const state = STATE_META[request.triageStatus]
  const deadlineLive =
    request.triageStatus === "open" || request.triageStatus === "needs_info"
      ? request.desiredDeadline
      : null
  const deadlineOverdue = deadlineLive !== null && isOverdue(deadlineLive)

  return (
    <Card className="relative gap-0 py-0 shadow-sm transition-shadow duration-150 focus-within:ring-2 focus-within:ring-ring hover:shadow-md">
      {/* Stretched open affordance: the card IS the button. */}
      <button
        type="button"
        onClick={() => onOpen(request.id)}
        aria-label={`Open request: ${request.title}`}
        className="absolute inset-0 rounded-xl outline-none"
      />

      <CardContent className="flex flex-col gap-2.5 px-3.5 py-3.5">
        <span className="inline-flex max-w-full items-center gap-2 self-start rounded-md bg-muted px-2 py-1">
          <InboxIcon
            aria-hidden
            className="size-3.5 shrink-0 text-foreground/70"
          />
          <span className="line-clamp-2 text-sm leading-snug font-medium text-foreground">
            {request.title}
          </span>
        </span>

        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {request.priority && (
              <span className="inline-flex items-center gap-1 capitalize">
                <FlagIcon aria-hidden className="size-3.5 shrink-0" />
                {request.priority}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <state.Icon
                aria-hidden
                className={`size-3.5 shrink-0 ${state.iconClass}`}
              />
              {REQUEST_META[request.triageStatus].label}
            </span>
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
                {formatDueDate(deadlineLive)}
              </span>
            )}
            {request.messageCount > 0 && (
              <span className="inline-flex items-center gap-1">
                <MessageSquareIcon aria-hidden className="size-3.5 shrink-0" />
                {request.messageCount}
              </span>
            )}
          </div>

          <span
            aria-hidden
            className="flex size-6 shrink-0 items-center overflow-hidden rounded-full bg-muted text-[10px] font-medium"
          >
            {request.requesterImage ? (
              <img
                src={request.requesterImage}
                alt=""
                className="size-6 object-cover"
              />
            ) : (
              (request.requesterName?.trim()[0] ?? "?").toUpperCase()
            )}
          </span>
        </div>

        <span aria-hidden className="sr-only">
          requested {formatRelativeTime(request.createdAt)}
        </span>
      </CardContent>
    </Card>
  )
}
