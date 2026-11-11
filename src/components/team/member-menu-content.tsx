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
 * A pending seat has no role to change and no membership to end — the invite is
 * the thing that exists, so revoking it is the only item. A joined member gets
 * the three management items. Suspension is still a stub and stays visibly
 * disabled rather than quietly missing.
 */
export function MemberMenuContent({
  member,
  rolePending,
  onPickRole,
  onRequestRemove,
  onRevokeInvite,
}: {
  member: WorkspaceMemberItem
  rolePending: boolean
  onPickRole: (roleTitle: string) => void
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

  return (
    <DropdownMenuContent align="end">
      <ChangeRoleMenu
        currentRole={member.role}
        pending={rolePending}
        onPick={onPickRole}
      />

      <DropdownMenuItem disabled>Suspend</DropdownMenuItem>

      <DropdownMenuSeparator />

      <DropdownMenuItem variant="destructive" onSelect={onRequestRemove}>
        Remove from workspace
      </DropdownMenuItem>
    </DropdownMenuContent>
  )
}
