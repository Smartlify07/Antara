"use client"

import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { ChangeRoleMenu } from "@/components/team/change-role-menu"
import type { WorkspaceMemberItem } from "@/server/services/workspace-service"

/**
 * What the `⋯` menu offers, by row shape.
 *
 * A pending seat has no role, no status and no membership to act on — the
 * invite is the only thing that exists, so revoking it is the only item.
 *
 * A joined member gets role, suspension and removal. The suspension item flips
 * with the seat's status, so the menu never offers an action the server would
 * refuse as a no-op.
 */
export function MemberMenuContent({
  member,
  rolePending,
  onPickRole,
  onRequestSuspend,
  onResume,
  onRequestRemove,
  onRevokeInvite,
}: {
  member: WorkspaceMemberItem
  rolePending: boolean
  onPickRole: (roleTitle: string) => void
  onRequestSuspend: () => void
  onResume: () => void
  onRequestRemove: () => void
  onRevokeInvite?: (inviteId: string) => void
}) {
  if (member.isPending) {
    return (
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          variant="destructive"
          disabled={!member.inviteId}
          onSelect={() => member.inviteId && onRevokeInvite?.(member.inviteId)}
        >
          Revoke invite
        </DropdownMenuItem>
      </DropdownMenuContent>
    )
  }

  const suspended = member.status === "suspended"

  return (
    <DropdownMenuContent align="end">
      <ChangeRoleMenu
        currentRole={member.role}
        pending={rolePending}
        onPick={onPickRole}
      />

      {suspended ? (
        <DropdownMenuItem onSelect={onResume}>Unsuspend</DropdownMenuItem>
      ) : (
        <DropdownMenuItem onSelect={onRequestSuspend}>Suspend</DropdownMenuItem>
      )}

      <DropdownMenuSeparator />

      <DropdownMenuItem variant="destructive" onSelect={onRequestRemove}>
        Remove from workspace
      </DropdownMenuItem>
    </DropdownMenuContent>
  )
}
