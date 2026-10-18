import { queryOptions } from "@tanstack/react-query"
import {
  listNotificationsFn,
  unreadCountFn,
} from "@/server/functions/notifications"

/**
 * Query keys for the notification lane. Both surfaces are keyed by slug —
 * the bell's call sites carry the slug and nothing else (the badge queries'
 * contract). The unread count and the inbox list are separate keys so a row
 * marked read through either path repaints both without dragging the other
 * back on the wire.
 */
export const notificationKeys = {
  all: ["notifications"] as const,
  list: (workspaceSlug: string) =>
    ["notifications", "list", workspaceSlug] as const,
  unread: (workspaceSlug: string) =>
    ["notifications", "unread", workspaceSlug] as const,
}

/**
 * The bell's badge. Freshness is deliberate and in-product only (the plan
 * rules out WebSockets/SSE): a focus refetch in case the tab has been sitting
 * in the background, plus a modest 30s interval while the workspace is open.
 */
export function unreadCountQuery(workspaceSlug: string) {
  return queryOptions({
    queryKey: notificationKeys.unread(workspaceSlug),
    queryFn: () => unreadCountFn({ data: { workspaceSlug } }),
    staleTime: 15_000,
    // Overrides the client's global false — the bell is the one surface that
    // must notice what changed elsewhere.
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
  })
}

/** The inbox rows behind the popover, newest first. */
export function notificationsQuery(workspaceSlug: string) {
  return queryOptions({
    queryKey: notificationKeys.list(workspaceSlug),
    queryFn: () => listNotificationsFn({ data: { workspaceSlug } }),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
  })
}
