import type { AssignableMember } from "@/server/services/project-service"
import type { TaskPriority } from "@/db/enums"
import type { TaskCard } from "@/server/services/task-service"
import { queryOptions } from "@tanstack/react-query"
import {
  listProjectTasksFn,
  myTasksBadgeFn,
  myTasksFn,
} from "@/server/functions/tasks"

/**
 * Query keys for tasks. The project list and the "My tasks" page are separate
 * keys by design — a status move on one surface must not drag the other back
 * on the wire (each mutation invalidates what it changed).
 */
export const taskKeys = {
  all: ["tasks"] as const,
  byProject: (projectId: string) => ["tasks", "project", projectId] as const,
  mine: (workspaceId: string) => ["tasks", "mine", workspaceId] as const,
  badge: (workspaceSlug: string) => ["tasks", "badge", workspaceSlug] as const,
}

/**
 * The `taskKeys.byProject` cache value, as `listProjectTasksFn` returns it:
 * the cards plus the viewer's write facts. An optimistic creation replaces
 * only `tasks` — `viewer` is resolved from access server-side, and a patch
 * made before the request has no way to recompute it, so it rides along
 * untouched.
 */
export interface ProjectTasksCache {
  tasks: TaskCard[]
  viewer: { canWork: boolean }
}

/**
 * Builds the card rendered between the click and the server's response.
 *
 * The `optimistic-` id prefix is what marks it: consumers that must not write
 * against a row the server has no record of yet key off the prefix, and
 * nothing else branches on a placeholder. Structurally it is a plain
 * `TaskCard` — deliberately, so the list and the rows need no special case
 * beyond that prefix check.
 *
 * `status` and `priority` mirror `createTask`'s insert defaults exactly, so
 * the placeholder never flashes one shape and snaps to another when the
 * settle refetch swaps it for the real row.
 */
export function buildOptimisticTask(
  // The fields the wire payload carries for a create. `priority` is left
  // undefined by the composer on purpose; the server defaults it.
  input: {
    title: string
    dueDate?: string | null
    deliverableId?: string | null
    assigneeTeamIds?: string[] | null
    priority?: TaskPriority
  },
  projectId: string,
  // Labels for the team ids, from the composer's member pool — the same ids
  // the create payload carries across the wire.
  members: AssignableMember[]
): TaskCard {
  const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
  const dueDate = input.dueDate ?? null

  return {
    id: `optimistic-${stamp}`,
    projectId,
    deliverableId: input.deliverableId ?? null,
    title: input.title,
    description: null,
    // The service's insert defaults (task-service `createTask`).
    status: "backlog",
    priority: input.priority ?? "medium",
    dueDate,
    // Provisional `false` rather than a today-derived stamp: the service
    // recomputes overdue on every read, so the settle refetch is
    // authoritative and the placeholder only needs to be harmless.
    overdue: false,
    assignees: (input.assigneeTeamIds ?? []).flatMap((teamId) => {
      const member = members.find((entry) => entry.teamId === teamId)
      if (!member) {
        // Not a nameable member — the server would refuse the whole write for
        // an unresolvable membership, so there is nothing truthful to render.
        return []
      }
      return [
        {
          projectMemberId: member.teamId,
          name: member.name,
          email: member.email,
          image: member.image,
        },
      ]
    }),
  }
}

/** Sorts after every real ISO date — the undated bucket runs last (NULLS LAST). */
const UNDATED_DUE = "9999-12-31"

/**
 * Where the server's create would land, so the placeholder can be written
 * into the list rather than merely appended somewhere — the settle refetch
 * keeps the row exactly where it first appeared instead of visibly moving it.
 *
 * `loadProjectTasks` orders the list `dueDate ASC NULLS LAST`, then
 * `createdAt ASC`; a just-created task carries the newest `createdAt`, so it
 * is the last row of its own due-date group. A dated task therefore slots
 * before the first row whose dueDate sorts after its own — including the
 * undated tail, which the sentinel makes sort last — and an undated one goes
 * to the very end.
 */
export function insertTaskCard(tasks: TaskCard[], task: TaskCard): TaskCard[] {
  // Lexically compare ISO date strings; the list's sortedness holds because
  // every writer (server refetch and this insert) keeps it that way.
  const key = task.dueDate ?? UNDATED_DUE
  const index = tasks.findIndex((row) => (row.dueDate ?? UNDATED_DUE) > key)
  if (index === -1) {
    return [...tasks, task]
  }
  return [...tasks.slice(0, index), task, ...tasks.slice(index)]
}

/** The project's tasks (deliverable-knit and loose), with viewer write facts. */
export function projectTasksQuery(workspaceId: string, projectId: string) {
  return queryOptions({
    queryKey: taskKeys.byProject(projectId),
    queryFn: () => listProjectTasksFn({ data: { workspaceId, projectId } }),
  })
}

/** The "My tasks" page across the workspace. */
export function myTasksQuery(workspaceId: string) {
  return queryOptions({
    queryKey: taskKeys.mine(workspaceId),
    queryFn: () => myTasksFn({ data: { workspaceId } }),
  })
}

/** Sidebar badge: open tasks assigned to the viewer. */
export function myTasksBadgeQuery(workspaceSlug: string) {
  return queryOptions({
    queryKey: taskKeys.badge(workspaceSlug),
    queryFn: () => myTasksBadgeFn({ data: { workspaceSlug } }),
  })
}
