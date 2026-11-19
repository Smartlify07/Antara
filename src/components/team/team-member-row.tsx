import { useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { LeaveWorkspaceAction } from "@/components/team/leave-workspace-action"
import { MemberActions } from "@/components/team/member-actions"
import { MemberPill } from "@/components/team/member-pill"
import { avatarTint } from "@/lib/avatar-tint"
import type { WorkspaceMemberItem } from "@/server/services/workspace-service"

function initials(member: WorkspaceMemberItem) {
  const fromName = member.name
    ?.split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
  return fromName ?? (member.email?.[0] ?? "?").toUpperCase()
}

/**
 * One person on the roster: identity, two status pills, and the actions menu.
 *
 * The owner has no management menu — their capability comes from `owner_id`,
 * so every item behind it would be refused by the server — but everyone,
 * owner included, gets the leave control on their own row.
 *
 * The error line lives here, under the row, because `MemberActions` unmounts
 * with the menu it reported from.
 */
export function TeamMemberRow({
  member,
  canManage,
  currentUserId,
  workspaceSlug,
  workspaceId,
  onRevokeInvite,
}: {
  member: WorkspaceMemberItem
  canManage: boolean
  /** The viewer's account id, so their own row can offer Leave. */
  currentUserId: string
  workspaceSlug: string
  workspaceId: string
  onRevokeInvite?: (inviteId: string) => void
}) {
  const [error, setError] = useState<string | null>(null)
  const isSelf = member.userId !== null && member.userId === currentUserId

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3">
        <Avatar className="size-9">
          <AvatarImage src={member.image ?? undefined} alt="" />
          <AvatarFallback
            className={`text-xs font-medium ${avatarTint(member.id)}`}
          >
            {initials(member)}
          </AvatarFallback>
        </Avatar>

        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium">
            {member.name ?? member.email}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {member.name
              ? member.email
              : member.invitedByName
                ? `Invited by ${member.invitedByName}`
                : "Invitation pending"}
          </span>
        </div>

        {/* On a phone the badges and the menu take their own line: a suspended
            member carries two pills, and sharing one row with the name left
            about four characters of it. `sm:w-auto` restores the single row. */}
        <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
          {member.isPending ? (
            <MemberPill tone="pending">Awaiting</MemberPill>
          ) : (
            member.status === "suspended" && (
              <MemberPill tone="muted">Suspended</MemberPill>
            )
          )}

          <MemberPill tone={member.isOwner ? "owner" : "role"}>
            {member.isOwner ? "owner" : member.role}
          </MemberPill>

          {isSelf ? (
            <LeaveWorkspaceAction workspaceSlug={workspaceSlug} />
          ) : (
            canManage &&
            !member.isOwner && (
              <MemberActions
                member={member}
                workspaceSlug={workspaceSlug}
                workspaceId={workspaceId}
                onRevokeInvite={onRevokeInvite}
                onError={setError}
              />
            )
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="px-3 pb-2 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
