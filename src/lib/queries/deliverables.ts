import { queryOptions } from "@tanstack/react-query"
import {
  listDeliverableThreadFn,
  listProjectDeliverablesFn,
} from "@/server/functions/deliverables"
import type { DeliverableThreadMessage } from "@/server/services/deliverable-service"

/**
 * Query keys for deliverables. Keyed by project id — the detail route owns the
 * project before these load, so an id key is usable on first declare (same
 * reasoning as projects' `detail` key comment, inverted).
 */
export const deliverableKeys = {
  all: ["deliverables"] as const,
  byProject: (projectId: string) =>
    ["deliverables", "project", projectId] as const,
  // The deliverable's own conversation — cached per deliverable so reopening
  // the cabinet does not refetch the thread.
  thread: (deliverableId: string) =>
    ["deliverables", "thread", deliverableId] as const,
}

/** The deliverable's conversation (subjectType "deliverable"), oldest first. */
export function deliverableThreadQuery(
  workspaceId: string,
  projectId: string,
  deliverableId: string
) {
  return queryOptions({
    queryKey: deliverableKeys.thread(deliverableId),
    queryFn: () =>
      listDeliverableThreadFn({
        data: { workspaceId, projectId, deliverableId },
      }),
  })
}

/** The project's deliverable cards, soonest deadline first. */
export function projectDeliverablesQuery(
  workspaceId: string,
  projectId: string
) {
  return queryOptions({
    queryKey: deliverableKeys.byProject(projectId),
    queryFn: () =>
      listProjectDeliverablesFn({ data: { workspaceId, projectId } }),
  })
}

/**
 * Builds the deliverable-conversation entry rendered before the server's
 * response — mirrors `buildOptimisticVersionFeedback` in versions.ts exactly
 * (same `optimistic-` prefix convention, same per-post stamp), because both
 * lanes share the unified comments table's row shape.
 */
export function buildOptimisticDeliverableComment(
  body: string,
  author: {
    authorId: string
    authorName: string | null
    authorEmail: string | null
  }
): DeliverableThreadMessage {
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
