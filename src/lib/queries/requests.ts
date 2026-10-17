import { queryOptions } from "@tanstack/react-query"
import {
  getRequestFn,
  listRequestsFn,
  requestBadgeFn,
  requestThreadFn,
} from "@/server/functions/requests"

/**
 * Query keys for request-scoped data, same contract as every other module:
 * a key can never drift from the identifier its server function needs.
 *
 * The thread and the card are separate keys by design — posting a message
 * or triaging invalidates the thread (and the badge) without dragging the
 * inbox back on the wire, and vice versa.
 */
export const requestKeys = {
  all: ["requests"] as const,
  inbox: (workspaceId: string) => ["requests", "inbox", workspaceId] as const,
  card: (requestId: string) => ["requests", "card", requestId] as const,
  thread: (requestId: string) => ["requests", "thread", requestId] as const,
  badge: (workspaceSlug: string) =>
    ["requests", "badge", workspaceSlug] as const,
}

/** The triage inbox: every request in this workspace, newest first. */
export function requestsQuery(workspaceId: string) {
  return queryOptions({
    queryKey: requestKeys.inbox(workspaceId),
    queryFn: () => listRequestsFn({ data: { workspaceId } }),
  })
}

/** One request card, for the detail surface. */
export function requestQuery(workspaceId: string, requestId: string) {
  return queryOptions({
    queryKey: requestKeys.card(requestId),
    queryFn: () => getRequestFn({ data: { workspaceId, requestId } }),
  })
}

/** The brief thread of one request, oldest first. */
export function requestThreadQuery(workspaceId: string, requestId: string) {
  return queryOptions({
    queryKey: requestKeys.thread(requestId),
    queryFn: () => requestThreadFn({ data: { workspaceId, requestId } }),
  })
}

/** Sidebar badge payload (count + whether the viewer may triage). */
export function requestBadgeQuery(workspaceSlug: string) {
  return queryOptions({
    queryKey: requestKeys.badge(workspaceSlug),
    queryFn: () => requestBadgeFn({ data: { workspaceSlug } }),
  })
}
