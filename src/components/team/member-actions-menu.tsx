"use client"

import { MoreHorizontalIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MemberMenuContent } from "@/components/team/member-menu-content"
import type { WorkspaceMemberItem } from "@/server/services/workspace-service"

/** The trigger plus its menu. Split from `MemberActions` so the mutations and
 * the confirm dialogs live in one file and this stays presentational. */
export function MemberActionsMenu({
  member,
  name,
  rolePending,
  onPickRole,
  onRequestSuspend,
  onResume,
  onRequestRemove,
  onRevokeInvite,
}: {
  member: WorkspaceMemberItem
  name: string
  rolePending: boolean
  onPickRole: (roleTitle: string) => void
  onRequestSuspend: () => void
  onResume: () => void
  onRequestRemove: () => void
  onRevokeInvite?: (inviteId: string) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Actions for ${name}`}
        >
          <MoreHorizontalIcon />
        </Button>
      </DropdownMenuTrigger>

      <MemberMenuContent
        member={member}
        rolePending={rolePending}
        onPickRole={onPickRole}
        onRequestSuspend={onRequestSuspend}
        onResume={onResume}
        onRequestRemove={onRequestRemove}
        onRevokeInvite={onRevokeInvite}
      />
    </DropdownMenu>
  )
}
