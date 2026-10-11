import { queryOptions } from "@tanstack/react-query"
import { inviteViewerFn, pendingInvitesFn } from "@/server/functions/invites"

/**
 * Query keys for the invitation flow.
 *
 * Lives here rather than inline in the route files so every key in the app is
 * declared the same way, in one place, under a prefix that can be invalidated
 * as a group.
 */
export const inviteKeys = {
  all: ["invites"] as const,
  /** Who is asking: signed in, and is the address confirmed. */
  viewer: ["invites", "viewer"] as const,
  /** Invitations waiting for this account, found by seat rather than by token. */
  pending: ["invites", "pending"] as const,
}

export function inviteViewerQuery() {
  return queryOptions({
    queryKey: inviteKeys.viewer,
    queryFn: () => inviteViewerFn(),
  })
}

export function pendingInvitesQuery() {
  return queryOptions({
    queryKey: inviteKeys.pending,
    queryFn: () => pendingInvitesFn(),
  })
}
