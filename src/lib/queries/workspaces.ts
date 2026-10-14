import { queryOptions } from "@tanstack/react-query"
import {
  listWorkspacesFn,
  workspaceTeamCountFn,
} from "@/server/functions/workspaces"

/**
 * Query keys for workspace-scoped data.
 *
 * Every factory takes the identifier the server function needs, so a key can
 * never drift from the request that fills it — the bug that made an
 * invalidation silently match nothing once already.
 */
export const workspaceKeys = {
  all: ["workspaces"] as const,
  list: ["workspaces", "list"] as const,
  teamCount: (workspaceSlug: string) =>
    ["workspaces", "teamCount", workspaceSlug] as const,
}

/** Every workspace this person belongs to, for the sidebar switcher. */
export function workspacesQuery() {
  return queryOptions({
    queryKey: workspaceKeys.list,
    queryFn: () => listWorkspacesFn(),
  })
}

/** Member count for the sidebar badge, keyed by slug. */
export function workspaceTeamCountQuery(workspaceSlug: string) {
  return queryOptions({
    queryKey: workspaceKeys.teamCount(workspaceSlug),
    queryFn: () => workspaceTeamCountFn({ data: { workspaceSlug } }),
  })
}
