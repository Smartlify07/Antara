import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import type { VersionThreadMessage } from "@/server/services/version-service"
import {
  decideVersionFn,
  listDeliverableVersionsFn,
  listReviewQueueFn,
  listVersionThreadFn,
  reviewQueueBadgeFn,
} from "@/server/functions/versions"
import type { DecideVersionInput } from "@/lib/version-schemas"
import { libraryKeys } from "@/lib/queries/library"

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

/** The decision payload every decider surface sends, workspace supplied. */
type DecideVersionPayload = Omit<DecideVersionInput, "workspaceId">

/**
 * One decision, from any decider surface — the cabinet's lane, the Reviews
 * queue, the library's asset page. The empty-note guard is the cabinet's
 * convention (a blank stays absent rather than becoming an empty comment).
 *
 * On settle the version lane and the library repaint regardless of outcome:
 * a success leaves the queue row, recounts the badge, and restamps every
 * state chip; a failure is usually the race ("just decided by someone
 * else"), where the refetch shows the truth instead of a stale row.
 */
export function useDecideVersion(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: DecideVersionPayload) =>
      decideVersionFn({
        data: {
          ...input,
          workspaceId,
          comment:
            input.comment && input.comment.length > 0
              ? input.comment
              : undefined,
        },
      }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: versionKeys.all })
      void queryClient.invalidateQueries({ queryKey: libraryKeys.all })
    },
  })
}

/**
 * Builds the feedback entry rendered between the submit and the server's
 * response — same `optimistic-` prefix convention as the brief thread and the
 * updates feed. Each post carries its own stamp, so overlapping sends roll
 * back independently.
 */
export function buildOptimisticVersionFeedback(
  body: string,
  author: {
    authorId: string
    authorName: string | null
    authorEmail: string | null
  }
): VersionThreadMessage {
  const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

  return {
    id: `optimistic-${stamp}`,
    body,
    createdAt: new Date(),
    authorId: author.authorId,
    authorName: author.authorName,
    authorEmail: author.authorEmail,
  }
}
