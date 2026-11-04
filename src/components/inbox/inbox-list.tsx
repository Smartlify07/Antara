import { InboxEmpty, InboxError, InboxLoading } from "./inbox-states"
import { InboxLoadMore } from "./inbox-load-more"
import { InboxRow } from "./inbox-row"
import type { InboxController } from "./use-inbox"

/**
 * The list itself. One arrival for the first page (skeletons, then either the
 * rows or the honest empty state), and the sentinel below keeps appending
 * pages while the reader scrolls.
 */
export function InboxList({ inbox }: { inbox: InboxController }) {
  if (inbox.isPending) return <InboxLoading />

  if (inbox.error) {
    return (
      <InboxError
        message={inbox.error instanceof Error ? inbox.error.message : undefined}
      />
    )
  }

  if (inbox.items.length === 0) return <InboxEmpty />

  return (
    <div>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border bg-card">
        {inbox.items.map((item) => (
          <InboxRow
            key={item.id}
            item={item}
            onOpen={() => inbox.open(item)}
            onMarkRead={() => inbox.markRead.mutate(item.id)}
          />
        ))}
      </ul>

      <InboxLoadMore
        hasNextPage={inbox.hasNextPage}
        isFetchingNextPage={inbox.isFetchingNextPage}
        onLoadMore={inbox.fetchNextPage}
      />
    </div>
  )
}
