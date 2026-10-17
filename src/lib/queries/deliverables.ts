import { queryOptions } from "@tanstack/react-query"
import { listProjectDeliverablesFn } from "@/server/functions/deliverables"

/**
 * Query keys for deliverables. Keyed by project id — the detail route owns the
 * project before these load, so an id key is usable on first declare (same
 * reasoning as projects' `detail` key comment, inverted).
 */
export const deliverableKeys = {
  all: ["deliverables"] as const,
  byProject: (projectId: string) =>
    ["deliverables", "project", projectId] as const,
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
