import { InboxHeader } from "./inbox-header"
import { InboxList } from "./inbox-list"
import { useInbox } from "./use-inbox"

/**
 * The Inbox page (FR-048..050): the bell's popover, promoted to a real
 * surface because the list is now long-lived, paginated, and useful enough to
 * live beside the work it points at.
 */
export function InboxPage({ workspaceSlug }: { workspaceSlug: string }) {
  const inbox = useInbox(workspaceSlug)

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <InboxHeader
        unreadCount={inbox.unreadCount}
        pending={inbox.markAllRead.isPending}
        onMarkAllRead={() => inbox.markAllRead.mutate()}
      />
      <InboxList inbox={inbox} />
    </div>
  )
}
