import { useMemo, useState } from "react"
import {
  CheckIcon,
  UserIcon,
  UserPlusIcon,
  UserStarIcon,
  UsersIcon,
} from "lucide-react"
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

/**
 * The person fields an avatar needs. A workspace member carries these, and so
 * does the deliverable cache's owner ref — the owner chip labels a person who
 * may not sit on the member list, so it reads from the ref, not the list.
 */
export type AvatarPerson = {
  teamId: string
  name: string | null
  email: string | null
  image: string | null
}

export function initials(member: AvatarPerson) {
  const fromName = member.name
    ?.split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
  return fromName ?? (member.email?.[0] ?? "?").toUpperCase()
}

export function displayName(member: AvatarPerson) {
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
export function AvatarStack({ members }: { members: AvatarPerson[] }) {
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

/**
 * The single-select owner pill (the lead pill's sibling, without the star):
 * one person from the searchable member list, clicking the picked person
 * again to unassign. The label reads the passed owner ref — the current owner
 * may not be a project member — while the options stay the member list.
 */
export function OwnerChip({
  members,
  owner,
  onSelect,
}: {
  members: AssignableMember[]
  /** Current owner as a plain person ref, or null when unassigned. */
  owner: AvatarPerson | null
  onSelect: (teamId: string | null) => void
}) {
  const [query, setQuery] = useState("")
  const visible = useFiltered(members, query)
  const offList =
    owner && !members.some((member) => member.teamId === owner.teamId)

  return (
    <Chip
      placeholder="Set owner"
      icon={<UserIcon className="size-3.5 shrink-0" />}
      label={
        owner ? (
          <span className="flex items-center gap-1.5">
            <AvatarStack members={[owner]} />
            <span className="truncate">{displayName(owner)}</span>
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
                selected={owner?.teamId === member.teamId}
                onSelect={() =>
                  onSelect(
                    owner?.teamId === member.teamId ? null : member.teamId
                  )
                }
              />
            ))}
          </CommandGroup>
          {/* An owner who left the project (or was never on it) is labelled
              but has no row to click off — keep an explicit way out. */}
          {offList && (
            <>
              <div className="mx-2 my-1 h-px bg-border" />
              <CommandItem
                value="__unassign__"
                onSelect={() => onSelect(null)}
                className="gap-2"
              >
                <span>Unassign owner</span>
              </CommandItem>
            </>
          )}
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
  onInviteClick,
}: {
  members: AssignableMember[]
  selectedIds: string[]
  leadId: string | null
  onToggle: (teamId: string) => void
  /**
   * Opens an invite dialog. Only rendered where the actor may invite — the
   * create form has no such affordance, since nobody exists to invite yet.
   */
  onInviteClick?: () => void
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
          {onInviteClick && (
            <>
              <div className="mx-2 my-1 h-px bg-border" />
              {/* Sentinel value, the same pattern as the tag chip's
                  `__create__`. A real value would let the keyboard select
                  "invite" as though it were a person. */}
              <CommandItem
                value="__invite__"
                onSelect={() => {
                  onInviteClick()
                  setQuery("")
                }}
                className="gap-2"
              >
                <UserPlusIcon className="size-3.5 shrink-0 text-muted-foreground" />
                <span>Invite someone new</span>
              </CommandItem>
            </>
          )}
        </CommandList>
      </Command>
    </Chip>
  )
}
