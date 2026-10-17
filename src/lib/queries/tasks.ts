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
