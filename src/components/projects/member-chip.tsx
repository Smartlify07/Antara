import { useMemo, useState } from "react"
import { CheckIcon, UserStarIcon, UsersIcon } from "lucide-react"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Chip } from "@/components/projects/chip"
import { avatarTint } from "@/lib/avatar-tint"
import type { AssignableMember } from "@/server/services/project-service"

function initials(member: AssignableMember) {
  const fromName = member.name
    ?.split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
  return fromName ?? (member.email?.[0] ?? "?").toUpperCase()
}

function displayName(member: AssignableMember) {
  return member.name ?? member.email ?? "Unknown"
}

function useFiltered(members: AssignableMember[], query: string) {
  return useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return members
    return members.filter((member) =>
      `${displayName(member)} ${member.email ?? ""}`
        .toLowerCase()
        .includes(needle)
    )
  }, [members, query])
}

function PersonRow({
  member,
  selected,
  disabled,
  onSelect,
}: {
  member: AssignableMember
  selected: boolean
  disabled?: boolean
  onSelect: () => void
}) {
  return (
    <CommandItem
      value={member.teamId}
      disabled={disabled}
      onSelect={onSelect}
      className="gap-2"
    >
      <Avatar className="size-5">
        {member.image ? <AvatarImage src={member.image} alt="" /> : null}
        <AvatarFallback className={`text-[9px] ${avatarTint(member.teamId)}`}>
          {initials(member)}
        </AvatarFallback>
      </Avatar>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate">{displayName(member)}</span>
        {!member.joined && (
          <span className="text-[10px] text-muted-foreground">
            Invited · no account
          </span>
        )}
      </span>
      {selected && <CheckIcon className="size-3.5 shrink-0" />}
    </CommandItem>
  )
}

const EMPTY_COPY = "No workspace members yet."

const MAX_STACK = 3

/** Overlapping avatars, with a +N bubble once more than MAX_STACK are picked. */
function AvatarStack({ members }: { members: AssignableMember[] }) {
  const shown = members.slice(0, MAX_STACK)
  const overflow = members.length - shown.length

  return (
    <span className="flex shrink-0 items-center">
      {shown.map((member, index) => (
        <Avatar
          key={member.teamId}
          className="size-4 ring-2 ring-secondary"
          style={{ marginLeft: index === 0 ? 0 : -6 }}
        >
          {member.image ? <AvatarImage src={member.image} alt="" /> : null}
          <AvatarFallback className={`text-[7px] ${avatarTint(member.teamId)}`}>
            {initials(member)}
          </AvatarFallback>
        </Avatar>
      ))}
      {overflow > 0 && (
        <span
          className="ml-[-6px] flex size-4 items-center justify-center rounded-full bg-muted text-[7px] font-medium text-muted-foreground ring-2 ring-secondary"
          title={`${overflow} more`}
        >
          +{overflow}
        </span>
      )}
    </span>
  )
}

function memberCountLabel(count: number) {
  return `${count} member${count === 1 ? "" : "s"}`
}

export function LeadChip({
  members,
  leadId,
  onSelect,
}: {
  members: AssignableMember[]
  leadId: string | null
  onSelect: (teamId: string | null) => void
}) {
  const [query, setQuery] = useState("")
  const visible = useFiltered(members, query)
  const lead = members.find((member) => member.teamId === leadId) ?? null

  return (
    <Chip
      placeholder="Assign a lead"
      icon={<UserStarIcon className="size-3.5 shrink-0" />}
      label={
        lead ? (
          <span className="flex items-center gap-1.5">
            <AvatarStack members={[lead]} />
            <span className="truncate">{displayName(lead)}</span>
          </span>
        ) : undefined
      }
    >
      <Command shouldFilter={false} className="bg-transparent">
        <CommandInput
          placeholder="Search people…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>
            {members.length === 0 ? EMPTY_COPY : "Nobody matches."}
          </CommandEmpty>
          <CommandGroup>
            {visible.map((member) => (
              <PersonRow
                key={member.teamId}
                member={member}
                selected={member.teamId === leadId}
                onSelect={() =>
                  onSelect(member.teamId === leadId ? null : member.teamId)
                }
              />
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </Chip>
  )
}

export function MembersChip({
  members,
  selectedIds,
  leadId,
  onToggle,
}: {
  members: AssignableMember[]
  selectedIds: string[]
  leadId: string | null
  onToggle: (teamId: string) => void
}) {
  const [query, setQuery] = useState("")
  const selectable = members.filter((member) => member.teamId !== leadId)
  const visible = useFiltered(selectable, query)
  const selected = selectable.filter((member) =>
    selectedIds.includes(member.teamId)
  )

  return (
    <Chip
      placeholder="Add members"
      icon={<UsersIcon className="size-3.5 shrink-0" />}
      label={
        selected.length > 0 ? (
          <span className="flex items-center gap-1.5">
            <AvatarStack members={selected} />
            <span className="truncate">
              {memberCountLabel(selected.length)}
            </span>
          </span>
        ) : undefined
      }
    >
      <Command shouldFilter={false} className="bg-transparent">
        <CommandInput
          placeholder="Search people…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>
            {members.length === 0
              ? EMPTY_COPY
              : selectable.length === 0
                ? "Everyone is already assigned."
                : "Nobody matches."}
          </CommandEmpty>
          <CommandGroup>
            {visible.map((member) => (
              <PersonRow
                key={member.teamId}
                member={member}
                selected={selectedIds.includes(member.teamId)}
                onSelect={() => onToggle(member.teamId)}
              />
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </Chip>
  )
}
