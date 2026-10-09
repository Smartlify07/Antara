import { queryOptions } from "@tanstack/react-query"
import { listPendingInvitesFn } from "@/server/functions/invites"

export interface PendingInviteRow {
  id: string
  email: string
  role: string
  expiresAt: Date
  createdAt: Date
  /**
   * Absent for non-admin callers. The server omits these entirely rather than
   * sending them for the UI to hide — "invited by" is reconnaissance about who
   * works with whom.
   */
  invitedByName?: string | null
  invitedByEmail?: string | null
}

export const inviteKeys = {
  all: ["invites"] as const,
  pending: (workspaceSlug: string) =>
    ["invites", "pending", workspaceSlug] as const,
}

/**
 * Pending invites for a workspace, invalidated after create and revoke.
 *
 * Not `router.invalidate()`, which refetched every active loader in the app
 * for a change that only affects this one list.
 */
export function pendingInvitesQuery(workspaceSlug: string) {
  return queryOptions({
    queryKey: inviteKeys.pending(workspaceSlug),
    queryFn: () => listPendingInvitesFn({ data: { workspaceSlug } }),
  })
}