import { format } from "date-fns"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ProjectPills } from "@/components/projects/details/project-pills"
import { TagDot } from "@/components/projects/tags-chip"
import { displayName, initials } from "@/components/projects/member-chip"
import { PROJECT_STATUS_META } from "@/lib/status-meta"
import { avatarTint } from "@/lib/avatar-tint"
import type { SelectedTag } from "@/components/projects/tags-chip"
import type {
  AssignableMember,
  ProjectDetail,
  ProjectMemberRef,
  ProjectTagOption,
} from "@/server/services/project-service"
import type { ProjectStatus } from "@/db/enums"

/**
 * The right column: the same editable pills, plus the Linear-style labelled
 * property rows.
 *
 * The pills are duplicated from the header row on purpose — same props, same
 * handlers, one shared query — so they cannot show different values. The rows
 * below are read-only and exist so the current state is scannable without
 * opening five popovers.
 */
export function ProjectProperties({
  project,
  members,
  memberRefs,
  tagOptions,
  selectedTags,
  canEdit,
  saving,
  pills,
  onInviteClick,
}: {
  project: ProjectDetail
  members: AssignableMember[]
  memberRefs: ProjectMemberRef[]
  tagOptions: ProjectTagOption[]
  selectedTags: SelectedTag[]
  canEdit: boolean
  saving: boolean
  pills: Omit<Parameters<typeof ProjectPills>[0], "tagOptions">
  onInviteClick?: () => void
}) {
  const lead = memberRefs.find((member) => member.isLead) ?? null
  const leadAssignable = lead?.teamId
    ? (members.find((member) => member.teamId === lead.teamId) ?? null)
    : null

  const plainMembers = memberRefs.filter(
    (member) => !member.isLead && member.teamId
  )
  const plainAssignables = plainMembers.flatMap((member) => {
    const found = members.find((m) => m.teamId === member.teamId)
    return found ? [found] : []
  })

  return (
    <div className="flex flex-col gap-4">
      <ProjectPills
        {...pills}
        tagOptions={tagOptions}
        onInviteClick={onInviteClick}
        disabled={saving}
      />

      <dl className="flex flex-col gap-2.5 text-sm">
        <Row label="Status">
          <StatusValue status={project.status} />
        </Row>

        <Row label="Lead">
          {leadAssignable ? (
            <span className="flex min-w-0 items-center gap-1.5">
              <Avatar className="size-4">
                {leadAssignable.image ? (
                  <AvatarImage src={leadAssignable.image} alt="" />
                ) : null}
                <AvatarFallback
                  className={`text-[7px] ${avatarTint(leadAssignable.teamId)}`}
                >
                  {initials(leadAssignable)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">{displayName(leadAssignable)}</span>
            </span>
          ) : (
            <Placeholder />
          )}
        </Row>

        <Row label="Members">
          {plainAssignables.length > 0 ? (
            <AvatarStack members={plainAssignables} />
          ) : (
            <Placeholder />
          )}
        </Row>

        <Row label="Tags">
          {selectedTags.length > 0 ? (
            <span className="flex flex-wrap items-center gap-1.5">
              {selectedTags.map((tag) => (
                <span
                  key={tag.id ?? tag.label}
                  className="flex items-center gap-1"
                >
                  <TagDot color={tag.color} />
                  <span className="truncate text-xs">{tag.label}</span>
                </span>
              ))}
            </span>
          ) : (
            <Placeholder />
          )}
        </Row>

        <Row label="Start">
          {project.startDate ? (
            <span className="text-xs">
              {format(new Date(project.startDate), "d MMM yyyy")}
            </span>
          ) : (
            <Placeholder />
          )}
        </Row>

        <Row label="End">
          {project.deadline ? (
            <span className="text-xs">
              {format(new Date(project.deadline), "d MMM yyyy")}
            </span>
          ) : (
            <Placeholder />
          )}
        </Row>
      </dl>

      {!canEdit && (
        <p className="text-xs text-muted-foreground">
          Only workspace admins can change project attributes.
        </p>
      )}
    </div>
  )
}

function StatusValue({ status }: { status: ProjectStatus }) {
  const meta = PROJECT_STATUS_META[status]
  const Icon = meta.icon
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${meta.textClass}`}
    >
      <Icon className="size-3.5" />
      {meta.label}
    </span>
  )
}

function Row({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-[5rem_minmax(0,1fr)] items-center gap-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 items-center">{children}</dd>
    </div>
  )
}

function Placeholder() {
  return <span className="text-xs text-muted-foreground">—</span>
}

const MAX_STACK = 3

function AvatarStack({ members }: { members: AssignableMember[] }) {
  const shown = members.slice(0, MAX_STACK)
  const overflow = members.length - shown.length

  return (
    <span className="flex shrink-0 items-center">
      {shown.map((member, index) => (
        <Avatar
          key={member.teamId}
          className="size-4 ring-2 ring-background"
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
          className="ml-[-6px] flex size-4 items-center justify-center rounded-full bg-muted text-[7px] font-medium text-muted-foreground ring-2 ring-background"
          title={`${overflow} more`}
        >
          +{overflow}
        </span>
      )}
    </span>
  )
}
