import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  NotificationMessage,
  UnreadOrb,
} from "@/components/notifications/notification-copy"
import { Button } from "@/components/ui/button"
import { avatarTint } from "@/lib/avatar-tint"
import { formatRelativeTime } from "@/lib/time"
import { cn } from "@/lib/utils"
import { CheckIcon } from "lucide-react"
import type { NotificationItem } from "@/server/services/notification-service"

/**
 * One inbox row: actor, the event's sentence, when it happened, and the
 * unread marker. The whole row is the link; the hover-only check is a second,
 * non-navigating action for "seen it, not going there yet".
 */
export function InboxRow({
  item,
  onOpen,
  onMarkRead,
}: {
  item: NotificationItem
  onOpen: () => void
  onMarkRead: () => void
}) {
  const unread = !item.readAt
  const seed =
    item.actor.id ?? item.actor.name ?? item.actor.email ?? "former-member"

  return (
    <li className={cn("group/row relative", unread && "bg-primary/[0.04]")}>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors outline-none focus-visible:bg-muted/60",
          unread ? "hover:bg-primary/[0.07]" : "hover:bg-muted/50"
        )}
      >
        <Avatar className="mt-0.5 size-8 shrink-0">
          {item.actor.image && <AvatarImage src={item.actor.image} alt="" />}
          <AvatarFallback
            className={cn("text-xs font-medium", avatarTint(seed))}
          >
            {(
              item.actor.name?.trim()[0] ??
              item.actor.email?.trim()[0] ??
              "?"
            ).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <span className="grid min-w-0 flex-1 gap-1">
          <span
            className={cn(
              "text-sm leading-snug",
              unread ? "font-medium" : "text-foreground/90"
            )}
          >
            <NotificationMessage parts={item.messageParts} focus={unread} />
          </span>
          <span className="text-xs text-muted-foreground">
            {formatRelativeTime(item.createdAt)}
          </span>
        </span>

        <span className="mt-2 flex size-4 shrink-0 items-center justify-center">
          {unread && <UnreadOrb />}
        </span>
      </button>

      {unread && (
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Mark read"
          className="absolute top-3 right-10 text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100"
          onClick={(event) => {
            event.stopPropagation()
            onMarkRead()
          }}
        >
          <CheckIcon />
        </Button>
      )}
    </li>
  )
}
