import { queryOptions } from "@tanstack/react-query"
import { listWorkspaceMembersFn } from "@/server/functions/workspaces"

export const teamKeys = {
  all: ["team"] as const,
  members: (workspaceId: string) => ["team", "members", workspaceId] as const,
}

export function teamMembersQuery(workspaceId: string) {
  return queryOptions({
    queryKey: teamKeys.members(workspaceId),
    queryFn: () => listWorkspaceMembersFn({ data: { workspaceId } }),
  })
}
