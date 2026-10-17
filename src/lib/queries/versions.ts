import { queryOptions } from "@tanstack/react-query"
import {
  listDeliverableVersionsFn,
  listReviewQueueFn,
  listVersionThreadFn,
  reviewQueueBadgeFn,
} from "@/server/functions/versions"

/**
 * Query keys for the version lane. The timeline is keyed by deliverable —
 * the project id is available to the fetcher through its validator, while
 * the key stays tight so writing one version doesn't repaint every
 * deliverable's expansion.
 */
export const versionKeys = {
  all: ["versions"] as const,
  byDeliverable: (deliverableId: string) =>
    ["versions", "deliverable", deliverableId] as const,
  thread: (versionId: string) => ["versions", "thread", versionId] as const,
  queue: (workspaceId: string) => ["versions", "queue", workspaceId] as const,
  badge: (workspaceSlug: string) =>
    ["versions", "badge", workspaceSlug] as const,
}

/** One deliverable's assets and version histories. */
export function deliverableVersionsQuery(
  workspaceId: string,
  projectId: string,
  deliverableId: string
) {
  return queryOptions({
    queryKey: versionKeys.byDeliverable(deliverableId),
    queryFn: () =>
      listDeliverableVersionsFn({
        data: { workspaceId, projectId, deliverableId },
      }),
  })
}

/** The feedback thread of one version (FR-027), oldest first. */
export function versionThreadQuery(
  workspaceId: string,
  projectId: string,
  versionId: string
) {
  return queryOptions({
    queryKey: versionKeys.thread(versionId),
    queryFn: () =>
      listVersionThreadFn({ data: { workspaceId, projectId, versionId } }),
  })
}

/** The Reviews queue for this workspace's authorized reviewers. */
export function reviewQueueQuery(workspaceId: string) {
  return queryOptions({
    queryKey: versionKeys.queue(workspaceId),
    queryFn: () => listReviewQueueFn({ data: { workspaceId } }),
  })
}

/** Sidebar badge payload (visibility + count) for the Reviews entry. */
export function reviewQueueBadgeQuery(workspaceSlug: string) {
  return queryOptions({
    queryKey: versionKeys.badge(workspaceSlug),
    queryFn: () => reviewQueueBadgeFn({ data: { workspaceSlug } }),
  })
}
