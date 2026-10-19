import {
  CalendarIcon,
  FlagIcon,
  InboxIcon,
  MessageSquareIcon,
  TagIcon,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { formatDueDate, isOverdue } from "@/lib/time"
import { avatarTint } from "@/lib/avatar-tint"
import { REQUEST_META } from "./request-meta"
import type { RequestListItem } from "@/server/services/request-service"
import type { RequestTriageStatus } from "@/db/enums"

/**
 * Status dot fills, one per triage state — a filled dot carrying the state
 * (Linear-style), never an outline glyph.
 */
const STATE_META: Record<RequestTriageStatus, { dotClass: string }> = {
  open: { dotClass: "bg-sky-500" },
  needs_info: { dotClass: "bg-amber-500" },
  accepted: { dotClass: "bg-emerald-600" },
  declined: { dotClass: "bg-foreground/30" },
}

function initials(name: string | null): string {
  return (
    name
      ?.split(" ")
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  )
}

/**
 * A request card in the intake grid, in the reviewed style: compact white
 * card, the title inside a slightly rounded badge with a request icon,
 * metadata right underneath it, and the requester's avatar pushed to the
 * far right of that row (justify-between). Avatars tint by the same
 * per-person colour the team page assigns (seeded by user id).
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
  // Same seed the team page uses, so a person keeps their colour everywhere.
  const tintSeed =
    request.requesterId ?? request.requesterName ?? "former-member"

  return (
    <Card className="relative gap-0 py-0 shadow-xs transition-shadow duration-150 focus-within:ring-2 focus-within:ring-ring hover:shadow-sm">
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
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            {request.priority && (
              <span className="inline-flex items-center gap-1 capitalize">
                <FlagIcon aria-hidden className="size-3.5 shrink-0" />
                {request.priority}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className={`inline-block size-2 shrink-0 rounded-full ${state.dotClass}`}
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

          <Avatar size="sm" aria-hidden>
            {request.requesterImage ? (
              <AvatarImage src={request.requesterImage} alt="" />
            ) : null}
            <AvatarFallback
              className={`text-[10px] font-medium ${avatarTint(tintSeed)}`}
            >
              {initials(request.requesterName)}
            </AvatarFallback>
          </Avatar>
        </div>
      </CardContent>
    </Card>
  )
}
