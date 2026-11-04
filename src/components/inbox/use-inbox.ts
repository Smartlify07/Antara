import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import {
  notificationKeys,
  notificationsInboxQuery,
  patchInboxItems,
  unreadCountQuery,
} from "@/lib/queries/notifications"
import type { NotificationInboxData } from "@/lib/queries/notifications"
import { notificationDestination } from "@/lib/notifications-navigation"
import {
  markAllNotificationsReadFn,
  markNotificationReadFn,
} from "@/server/functions/notifications"
import type { NotificationItem } from "@/server/services/notification-service"

/**
 * The Inbox page's behaviour: pages, optimistic reads, and the exact
 * destination for each row. Kept out of the components so the page itself is
 * markup — and so the destination rule lives in one tested pure module.
 */
export function useInbox(workspaceSlug: string) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const inbox = useInfiniteQuery(notificationsInboxQuery(workspaceSlug))
  const { data: unreadCount = 0 } = useQuery(unreadCountQuery(workspaceSlug))

  const items = inbox.data?.pages.flatMap((page) => page.items) ?? []

  const unreadKey = notificationKeys.unread(workspaceSlug)
  const listKey = notificationKeys.list(workspaceSlug)

  const markRead = useMutation({
    mutationFn: (notificationId: string) =>
      markNotificationReadFn({ data: { workspaceSlug, notificationId } }),
    // Optimism is scoped: the row goes read instantly, and the badge only
    // dips when that row was still unread in the cache. A stale double click
    // therefore cannot walk the count below zero.
    onMutate: async (notificationId) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: unreadKey }),
        queryClient.cancelQueries({ queryKey: listKey }),
      ])
      const previousCount = queryClient.getQueryData<number>(unreadKey)
      const previousList =
        queryClient.getQueryData<NotificationInboxData>(listKey)

      const row = previousList?.pages
        .flatMap((page) => page.items)
        .find((item) => item.id === notificationId)

      if (row && !row.readAt) {
        patchInboxItems(queryClient, workspaceSlug, (item) =>
          item.id === notificationId ? { ...item, readAt: new Date() } : item
        )
        queryClient.setQueryData(unreadKey, (count?: number) =>
          Math.max(0, (count ?? previousCount ?? 0) - 1)
        )
      }
      return { previousCount, previousList }
    },
    onError: (_error, _id, context) => {
      if (context?.previousCount !== undefined) {
        queryClient.setQueryData(unreadKey, context.previousCount)
      }
      if (context?.previousList) {
        queryClient.setQueryData(listKey, context.previousList)
      }
    },
    onSettled: () => {
      // The list is already patched and the cursor order did not change, so
      // only the counter needs the server's word.
      void queryClient.invalidateQueries({ queryKey: unreadKey })
    },
  })

  const markAllRead = useMutation({
    mutationFn: () => markAllNotificationsReadFn({ data: { workspaceSlug } }),
    onMutate: async () => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: unreadKey }),
        queryClient.cancelQueries({ queryKey: listKey }),
      ])
      const previousCount = queryClient.getQueryData<number>(unreadKey)
      const previousList =
        queryClient.getQueryData<NotificationInboxData>(listKey)

      patchInboxItems(queryClient, workspaceSlug, (item) =>
        item.readAt ? item : { ...item, readAt: new Date() }
      )
      queryClient.setQueryData(unreadKey, 0)
      return { previousCount, previousList }
    },
    onError: (_error, _id, context) => {
      if (context?.previousCount !== undefined) {
        queryClient.setQueryData(unreadKey, context.previousCount)
      }
      if (context?.previousList) {
        queryClient.setQueryData(listKey, context.previousList)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: listKey })
      void queryClient.invalidateQueries({ queryKey: unreadKey })
    },
  })

  /** Mark read, then jump to the row's exact surface. */
  function open(item: NotificationItem) {
    if (!item.readAt) markRead.mutate(item.id)
    const destination = notificationDestination(item, workspaceSlug)
    if (destination) void navigate(destination)
  }

  return {
    items,
    isPending: inbox.isPending,
    error: inbox.error,
    hasNextPage: inbox.hasNextPage,
    isFetchingNextPage: inbox.isFetchingNextPage,
    fetchNextPage: inbox.fetchNextPage,
    unreadCount,
    markAllRead,
    markRead,
    open,
  }
}

export type InboxController = ReturnType<typeof useInbox>
