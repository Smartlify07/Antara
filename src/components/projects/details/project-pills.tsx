import { DatesChip } from "@/components/projects/dates-chip"
import { LeadChip, MembersChip } from "@/components/projects/member-chip"
import { StatusChip } from "@/components/projects/status-chip"
import { TagsChip } from "@/components/projects/tags-chip"
import type { SelectedTag } from "@/components/projects/tags-chip"
import type {
  AssignableMember,
  ProjectTagOption,
} from "@/server/services/project-service"
import type { ProjectStatus } from "@/db/enums"

/**
 * The attribute pill row.
 *
 * Rendered twice on the details page — once under the title, once in the right
 * column — from the same props and the same handlers. That duplication is
 * intentional: it gives a fast edit control near the title and a persistent one
 * beside the labelled property rows. Both read one query, so they cannot drift
 * apart; do not "fix" this by giving one of them its own state.
 */
export function ProjectPills({
  status,
  onStatusChange,
  members,
  leadId,
  onLeadChange,
  selectedMemberIds,
  onMemberToggle,
  tagOptions,
  selectedTags,
  onTagsChange,
  startDate,
  deadline,
  onDatesChange,
  onInviteClick,
  disabled,
}: {
  status: ProjectStatus
  onStatusChange: (next: ProjectStatus) => void
  members: AssignableMember[]
  leadId: string | null
  onLeadChange: (teamId: string | null) => void
  selectedMemberIds: string[]
  onMemberToggle: (teamId: string) => void
  tagOptions: ProjectTagOption[]
  selectedTags: SelectedTag[]
  onTagsChange: (next: SelectedTag[]) => void
  startDate: Date | null
  deadline: Date | null
  onDatesChange: (next: {
    startDate: Date | null
    deadline: Date | null
  }) => void
  onInviteClick?: () => void
  disabled?: boolean
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <StatusChip status={status} onChange={onStatusChange} />
      <LeadChip members={members} leadId={leadId} onSelect={onLeadChange} />
      <MembersChip
        members={members}
        selectedIds={selectedMemberIds}
        leadId={leadId}
        onToggle={onMemberToggle}
        onInviteClick={onInviteClick}
      />
      <TagsChip
        options={tagOptions}
        selected={selectedTags}
        onChange={onTagsChange}
      />
      <DatesChip
        startDate={startDate}
        deadline={deadline}
        onChange={onDatesChange}
      />
      {disabled && <span className="sr-only">Saving changes…</span>}
    </div>
  )
}
