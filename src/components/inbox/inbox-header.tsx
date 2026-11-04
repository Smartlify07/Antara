import { Button } from "@/components/ui/button"
import { CheckIcon } from "lucide-react"

/**
 * The page's one header: title, the honest scope line, and the batch action.
 * "Mark all read" only exists when something is actually unread.
 */
export function InboxHeader({
  unreadCount,
  pending,
  onMarkAllRead,
}: {
  unreadCount: number
  pending: boolean
  onMarkAllRead: () => void
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Inbox</h1>
        <p className="text-sm text-muted-foreground">
          Work assigned to you, review requests, feedback and decisions from
          this workspace.
        </p>
      </div>

      {unreadCount > 0 && (
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
            {unreadCount} unread
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            disabled={pending}
            onClick={onMarkAllRead}
          >
            <CheckIcon />
            Mark all read
          </Button>
        </div>
      )}
    </header>
  )
}
