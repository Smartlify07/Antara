"use client"

import { useState } from "react"
import { MemberActionsMenu } from "@/components/team/member-actions-menu"
import { MEMBER_CONFIRM_COPY } from "@/components/team/member-confirm-copy"
import { MemberConfirmDialog } from "@/components/team/member-confirm-dialog"
import { useMemberMutations } from "@/lib/queries/teams"
import type { WorkspaceMemberItem } from "@/server/services/workspace-service"

type ConfirmKind = "remove" | "suspend"

/**
 * The per-row `⋯` menu.
 *
 * Role changes and unsuspension apply on pick — both are reversible and the
 * roster re-renders in place. Removal and suspension are confirmed, because
 * both cut access. Failures from a menu action report on the row; failures from
 * the dialog report inside it, where it outlives the refusal.
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
  const { changeRole, remove, suspend, unsuspend } = useMemberMutations(
    workspaceSlug,
    workspaceId
  )
  const [confirm, setConfirm] = useState<ConfirmKind | null>(null)
  const name = member.name ?? member.email ?? "this member"

  function runFromMenu(fallback: string, call: () => Promise<unknown>) {
    onError(null)
    call().catch((cause) =>
      onError(cause instanceof Error ? cause.message : fallback)
    )
  }

  function requestConfirm(kind: ConfirmKind) {
    onError(null)
    setConfirm(kind)
  }

  const copy = confirm ? MEMBER_CONFIRM_COPY[confirm] : null

  return (
    <>
      <MemberActionsMenu
        member={member}
        name={name}
        rolePending={changeRole.isPending}
        onPickRole={(roleTitle) =>
          runFromMenu("Could not change this member's role.", () =>
            changeRole.mutateAsync({ membershipId: member.id, roleTitle })
          )
        }
        onRequestSuspend={() => requestConfirm("suspend")}
        onResume={() =>
          runFromMenu("Could not unsuspend this member.", () =>
            unsuspend.mutateAsync(member.id)
          )
        }
        onRequestRemove={() => requestConfirm("remove")}
        onRevokeInvite={onRevokeInvite}
      />

      <MemberConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => setConfirm(open ? confirm : null)}
        title={copy ? copy.title(name) : ""}
        description={copy?.description ?? ""}
        confirmLabel={copy?.confirmLabel ?? ""}
        pendingLabel={copy?.pendingLabel ?? ""}
        destructive={copy?.destructive}
        run={() =>
          confirm === "remove"
            ? remove.mutateAsync(member.id)
            : suspend.mutateAsync(member.id)
        }
      />
    </>
  )
}
