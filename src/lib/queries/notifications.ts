import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query"
import type { InfiniteData, QueryClient } from "@tanstack/react-query"
import {
  listNotificationsFn,
  unreadCountFn,
} from "@/server/functions/notifications"
import type {
  NotificationItem,
  NotificationPage,
} from "@/server/services/notification-service"

/**
 * Query keys for the notification lane. The unread count and the inbox list
 * are separate keys so a row marked read through either surface repaints both
 * without dragging the other back on the wire.
 */
export const notificationKeys = {
  all: ["notifications"] as const,
  list: (workspaceSlug: string) =>
    ["notifications", "list", workspaceSlug] as const,
  unread: (workspaceSlug: string) =>
    ["notifications", "unread", workspaceSlug] as const,
}

/** The shape an infinite inbox query holds in the cache. */
export type NotificationInboxData = InfiniteData<
  NotificationPage,
  string | undefined
>

/**
 * The sidebar's badge. Freshness is deliberate and in-product only (the plan
 * rules out WebSockets/SSE): a focus refetch in case the tab has been sitting
 * in the background, plus a modest 30s interval while the workspace is open.
 */
export function unreadCountQuery(workspaceSlug: string) {
  return queryOptions({
    queryKey: notificationKeys.unread(workspaceSlug),
    queryFn: () => unreadCountFn({ data: { workspaceSlug } }),
    staleTime: 15_000,
    // Overrides the client's global false — the badge is the one surface that
    // must notice what changed elsewhere.
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
  })
}

/**
 * The Inbox page's pages, newest first. Infinite scrolling appends the next
 * keyset page; no interval here (the page is the active surface and the badge
 * already polls) — a focus refetch is enough after returning to the tab.
 */
export function notificationsInboxQuery(workspaceSlug: string) {
  return infiniteQueryOptions({
    queryKey: notificationKeys.list(workspaceSlug),
    queryFn: ({ pageParam }) =>
      listNotificationsFn({
        data: { workspaceSlug, cursor: pageParam },
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  })
}

/**
 * Applies an optimistic row patch across every loaded page. Both the row tap
 * and the hover action settle into the same shape, so the pages stay a single
 * source of truth while the server round trip decides.
 */
export function patchInboxItems(
  queryClient: QueryClient,
  workspaceSlug: string,
  patch: (item: NotificationItem) => NotificationItem
) {
  queryClient.setQueryData<NotificationInboxData>(
    notificationKeys.list(workspaceSlug),
    (data) =>
      data
        ? {
            ...data,
            pages: data.pages.map((page) => ({
              ...page,
              items: page.items.map(patch),
            })),
          }
        : data
  )
}
