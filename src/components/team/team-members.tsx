import { useState } from "react"
import { SearchIcon } from "lucide-react"
import { Input } from "@/components/ui/input"
import { TeamMemberRow } from "@/components/team/team-member-row"
import type { WorkspaceMemberItem } from "@/server/services/workspace-service"

/**
 * The roster: search plus one row per member. Mutations live in the row's
 * actions menu, so this file stays a list.
 */
export function TeamMembers({
  members,
  canManage,
  action,
  workspaceSlug,
  workspaceId,
  onRevokeInvite,
}: {
  members: WorkspaceMemberItem[]
  canManage: boolean
  /** Slot for the invite button, so it isn't duplicated per consumer. */
  action?: React.ReactNode
  workspaceSlug: string
  /** Keys the member query — a different identifier from the slug. */
  workspaceId: string
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
          <TeamMemberRow
            key={member.id}
            member={member}
            canManage={canManage}
            workspaceSlug={workspaceSlug}
            workspaceId={workspaceId}
            onRevokeInvite={onRevokeInvite}
          />
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
