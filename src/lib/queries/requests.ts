import { queryOptions } from "@tanstack/react-query"
import type { RequestThreadMessage } from "@/server/services/request-service"
import {
  getRequestFn,
  listRequestCategoriesFn,
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

/**
 * Distinct categories in use in the workspace — suggestions for the intake
 * form's category pill (the field itself stays free text).
 */
export function requestCategoriesQuery(workspaceId: string) {
  return queryOptions({
    queryKey: ["requests", "categories", workspaceId] as const,
    queryFn: () => listRequestCategoriesFn({ data: { workspaceId } }),
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

/**
 * Builds the message rendered between the submit and the server's response —
 * the `optimistic-` prefix is what marks it, the same convention the updates
 * feed and the task composer use, so nothing needs a special type beyond a
 * prefix check. The author is the session's user, since that is what the
 * server will stamp on the real row.
 */
export function buildOptimisticThreadMessage(
  body: string,
  author: {
    authorId: string
    authorName: string | null
    authorImage: string | null
  }
): RequestThreadMessage {
  const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

  return {
    id: `optimistic-${stamp}`,
    body,
    authorId: author.authorId,
    authorName: author.authorName,
    authorImage: author.authorImage,
    createdAt: new Date(),
  }
}
