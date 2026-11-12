"use client"

import { useState } from "react"
import { MoreHorizontalIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MemberMenuContent } from "@/components/team/member-menu-content"
import { RemoveMemberDialog } from "@/components/team/remove-member-dialog"
import { useMemberMutations } from "@/lib/queries/teams"
import type { WorkspaceMemberItem } from "@/server/services/workspace-service"

/**
 * The per-row `⋯` menu. A role change applies on pick — reversible, and the
 * roster re-renders in place. Removal is confirmed, because it ends access.
 *
 * Role-change failures are reported up to the row: the menu has closed by then.
 * Removal reports inside its dialog, which outlives the refusal.
 */
export function MemberActions({
  member,
  workspaceSlug,
  workspaceId,
  onRevokeInvite,
  onError,
}: {
  member: WorkspaceMemberItem
  workspaceSlug: string
  workspaceId: string
  onRevokeInvite?: (inviteId: string) => void
  onError: (message: string | null) => void
}) {
  const { changeRole } = useMemberMutations(workspaceSlug, workspaceId)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const name = member.name ?? member.email ?? "this member"

  function applyRole(roleTitle: string) {
    onError(null)
    changeRole.mutate(
      { membershipId: member.id, roleTitle },
      {
        onError: (cause) =>
          onError(
            cause instanceof Error
              ? cause.message
              : "Could not change this member's role."
          ),
      }
    )
  }

  return (
    <>
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
          rolePending={changeRole.isPending}
          onPickRole={applyRole}
          onRequestRemove={() => {
            onError(null)
            setConfirmOpen(true)
          }}
          onRevokeInvite={onRevokeInvite}
        />
      </DropdownMenu>

      <RemoveMemberDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        membershipId={member.id}
        name={name}
        workspaceSlug={workspaceSlug}
        workspaceId={workspaceId}
      />
    </>
  )
}
