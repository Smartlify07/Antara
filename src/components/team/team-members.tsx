import { useState } from "react"
import { SearchIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { avatarTint } from "@/lib/avatar-tint"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { WorkspaceMemberItem } from "@/server/services/workspace-service"
import { MoreHorizontalIcon } from "lucide-react"
import { cn } from "@/lib/utils"

function initials(member: WorkspaceMemberItem) {
  const fromName = member.name
    ?.split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
  return fromName ?? (member.email?.[0] ?? "?").toUpperCase()
}

export function TeamMembers({
  members,
  canManage,
  action,
  onRevokeInvite,
}: {
  members: WorkspaceMemberItem[]
  canManage: boolean
  /** Slot for the invite button, so it isn't duplicated per consumer. */
  action?: React.ReactNode
  /** Receives the *invite* id, not the membership id. */
  onRevokeInvite?: (inviteId: string) => void
}) {
  const [query, setQuery] = useState("")

  const filtered = members.filter((member) =>
    `${member.name ?? ""} ${member.email ?? ""}`
      .toLowerCase()
      .includes(query.trim().toLowerCase())
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:max-w-64 sm:flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search members…"
            aria-label="Search members"
            className="pl-8"
          />
        </div>
        {action}
      </div>

      <div className="divide-y divide-border rounded-xl border">
        {filtered.map((member) => (
          <div key={member.id} className="flex items-center gap-3 p-3">
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
            {member.isPending ? (
              <span className="shrink-0 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                Awaiting
              </span>
            ) : (
              member.status === "suspended" && (
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  Suspended
                </span>
              )
            )}
            <span
              className={cn(
                "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium",
                member.isOwner
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground"
              )}
            >
              {member.isOwner ? "owner" : member.role}
            </span>
            {canManage && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Actions for ${member.name ?? member.email}`}
                  >
                    <MoreHorizontalIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {member.isPending ? (
                    <DropdownMenuItem
                      variant="destructive"
                      disabled={!member.inviteId}
                      onSelect={() =>
                        member.inviteId && onRevokeInvite?.(member.inviteId)
                      }
                    >
                      Revoke invite
                    </DropdownMenuItem>
                  ) : (
                    <>
                      <DropdownMenuItem disabled>Change role</DropdownMenuItem>
                      <DropdownMenuItem disabled>
                        {member.status === "suspended"
                          ? "Unsuspend"
                          : "Suspend"}
                      </DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" disabled>
                        Remove from workspace
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="p-8 text-center text-sm text-muted-foreground">
            {members.length === 0
              ? "No members yet."
              : "No members match your search."}
          </p>
        )}
      </div>
    </div>
  )
}
