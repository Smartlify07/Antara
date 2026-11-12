import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import { listWorkspaceMembersFn } from "@/server/functions/workspaces"
import {
  changeMemberRoleFn,
  leaveWorkspaceFn,
  removeMemberFn,
  suspendMemberFn,
  unsuspendMemberFn,
} from "@/server/functions/members"
import { workspaceKeys } from "@/lib/queries/workspaces"

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

/**
 * Member mutations, with the invalidation they share.
 *
 * Both a role change and a removal can move the sidebar badge as well as the
 * roster — a removed member stops being counted, and the badge counts exactly
 * what the roster shows. Refreshing one without the other leaves the header
 * disagreeing with the list.
 *
 * Deliberately not optimistic: the row that changed is the row the admin is
 * looking at, and a refused role change must not flash a wrong pill first.
 */
export function useMemberMutations(workspaceSlug: string, workspaceId: string) {
  const client = useQueryClient()

  const invalidate = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: teamKeys.members(workspaceId) }),
      client.invalidateQueries({
        queryKey: workspaceKeys.teamCount(workspaceSlug),
      }),
    ])

  const changeRole = useMutation({
    mutationFn: (input: { membershipId: string; roleTitle: string }) =>
      changeMemberRoleFn({ data: { workspaceSlug, ...input } }),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: (membershipId: string) =>
      removeMemberFn({ data: { workspaceSlug, membershipId } }),
    onSuccess: invalidate,
  })

  const suspend = useMutation({
    mutationFn: (membershipId: string) =>
      suspendMemberFn({ data: { workspaceSlug, membershipId } }),
    onSuccess: invalidate,
  })

  const unsuspend = useMutation({
    mutationFn: (membershipId: string) =>
      unsuspendMemberFn({ data: { workspaceSlug, membershipId } }),
    onSuccess: invalidate,
  })

  return { changeRole, remove, suspend, unsuspend }
}

/**
 * Leaving invalidates the switcher, not the roster: the caller is about to be
 * redirected out of this workspace, so refreshing its member list would be work
 * for a page they will no longer be allowed to read.
 */
export function useLeaveWorkspace(workspaceSlug: string) {
  const client = useQueryClient()

  return useMutation({
    mutationFn: () => leaveWorkspaceFn({ data: { workspaceSlug } }),
    onSuccess: () => client.invalidateQueries({ queryKey: workspaceKeys.list }),
  })
}
