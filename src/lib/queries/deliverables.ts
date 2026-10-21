import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import {
  listDeliverableThreadFn,
  listProjectDeliverablesFn,
} from "@/server/functions/deliverables"
import type { DeliverableStatus } from "@/db/enums"
import type {
  DeliverableCard,
  DeliverableThreadMessage,
} from "@/server/services/deliverable-service"

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

/** The overdueness the server stamps onto every card (`listProjectDeliverables`). */
export function stampDeliverableOverdue(
  deadline: string | null,
  status: DeliverableStatus
): boolean {
  const today = new Date().toISOString().slice(0, 10)
  return deadline !== null && deadline < today && status !== "completed"
}

/**
 * What `projectDeliverablesQuery` caches — the service fn's return shape,
 * named here so the optimistic patcher can type its snapshot.
 */
interface ProjectDeliverablesCache {
  deliverables: DeliverableCard[]
  viewer: { canManage: boolean }
}

/** Status-move variables: the production state the card paints immediately. */
export interface DeliverableStatusVars {
  deliverableId: string
  status: DeliverableStatus
}

/** Owner reassignment variables; `owner` is what the cache paints while the
 * server resolves the same fields from its `ownerSelect()` join. */
export interface DeliverableOwnerVars {
  deliverableId: string
  ownerId: string | null
  owner: DeliverableCard["owner"]
}

/** Deadline variables; date-only strings, the wire shape. */
export interface DeliverableDeadlineVars {
  deliverableId: string
  deadline: string | null
}

/**
 * A deliverable write that paints first, the same contract the project
 * details pills give `useProjectPills`' `write`: cancel in-flight refetches
 * of the list, patch the one card in the cache, restore the snapshot on
 * refusal, and refetch to settle. The optimistic step is a latency
 * optimisation, not a second source of truth — the server's answer replaces
 * it either way.
 *
 * `optimistic` receives the full card so the patch can recompute
 * server-stamped facts (overdueness travels with status and deadline); `vars`
 * must carry the `deliverableId` — the hook finds the row with it.
 */
export function useDeliverableCardWrite<
  TVars extends { deliverableId: string },
>({
  projectId,
  onError,
  settle,
  action,
  optimistic,
}: {
  projectId: string
  /** Surfaced on refusal, cleared on the next attempt. */
  onError?: (message: string | null) => void
  /** Runs after the settle refetch IS queued — the panel's refresh role. */
  settle?: () => unknown
  action: (variables: TVars) => Promise<unknown>
  optimistic: (card: DeliverableCard, variables: TVars) => DeliverableCard
}) {
  const queryClient = useQueryClient()
  const listKey = deliverableKeys.byProject(projectId)

  return useMutation({
    mutationKey: ["deliverable-card", projectId],
    mutationFn: (variables: TVars) => action(variables),
    onMutate: async (variables) => {
      onError?.(null)
      await queryClient.cancelQueries({ queryKey: listKey })
      const snapshot =
        queryClient.getQueryData<ProjectDeliverablesCache>(listKey)
      if (snapshot) {
        queryClient.setQueryData<ProjectDeliverablesCache>(listKey, {
          ...snapshot,
          deliverables: snapshot.deliverables.map((card) =>
            card.id === variables.deliverableId
              ? optimistic(card, variables)
              : card
          ),
        })
      }
      return { snapshot }
    },
    onError: (error, _variables, context) => {
      if (context?.snapshot) {
        queryClient.setQueryData(listKey, context.snapshot)
      }
      onError?.(
        error instanceof Error ? error.message : "Something went wrong."
      )
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: listKey })
      await settle?.()
    },
  })
}
