import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { AlertCircleIcon } from "lucide-react"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { TabsSwitcher } from "@/components/projects/details/tabs-switcher"
import { ProjectDescription } from "@/components/projects/details/project-description"
import { ProjectPills } from "@/components/projects/details/project-pills"
import { ProjectTitle } from "@/components/projects/details/project-title"
import { ProjectProperties } from "@/components/projects/details/project-properties"
import { UpdateCard } from "@/components/projects/details/update-card"
import { UpdateComposer } from "@/components/projects/details/update-composer"
import { InviteMemberDialog } from "@/components/projects/details/invite-member-dialog"
import { useProjectPills } from "@/components/projects/details/use-project-pills"
import { TagDot } from "@/components/projects/tags-chip"
import { projectUpdatesQuery } from "@/lib/queries/projects"
import type { SelectedTag } from "@/components/projects/tags-chip"
import type {
  AssignableMember,
  ProjectDetail,
  ProjectTagOption,
} from "@/server/services/project-service"

export function ProjectDetailPage({
  workspaceId,
  project,
  members,
  tagOptions,
  canEdit,
}: {
  workspaceId: string
  project: ProjectDetail
  members: AssignableMember[]
  tagOptions: ProjectTagOption[]
  canEdit: boolean
}) {
  const [error, setError] = useState<string | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  // Controlled so the switcher's indicator knows which tab to slide to; Radix
  // only reports the change.
  const [tab, setTab] = useState("overview")

  const updates = useQuery(projectUpdatesQuery(workspaceId, project.id))

  const memberRefs = project.members
  const leadRef = memberRefs.find((member) => member.isLead) ?? null

  const selectedTags: SelectedTag[] = useMemo(
    () =>
      project.tags.map((tag) => ({
        id: tag.id,
        label: tag.label,
        color: tag.color,
      })),
    [project.tags]
  )

  // Declared before `pillState` because the state object wires these handlers
  // up — referencing it the other way round would be a TDZ error at render.
  const pills = useProjectPills({
    workspaceId,
    project,
    allMembers: members,
    onError: setError,
  })

  const pillState = {
    status: project.status,
    onStatusChange: pills.status.mutate,
    members,
    leadId: leadRef?.teamId ?? null,
    onLeadChange: pills.handleLeadChange,
    // The lead is excluded here for the same reason the create form excludes
    // them: the lead is a membership row too, so counting them twice would
    // show one person as both lead and member.
    selectedMemberIds: memberRefs
      .filter((member) => !member.isLead && member.teamId)
      .map((member) => member.teamId as string),
    onMemberToggle: pills.handleMembersToggle,
    selectedTags,
    onTagsChange: pills.tags.mutate,
    startDate: project.startDate,
    deadline: project.deadline,
    onDatesChange: pills.dates.mutate,
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div>
          <ProjectTitle
            title={project.title}
            canEdit={canEdit}
            saving={pills.title.isPending}
            onSave={(next) => pills.title.mutate(next)}
          />
          <p className="text-sm tracking-tight text-muted-foreground">
            {project.taskCount} task{project.taskCount === 1 ? "" : "s"} ·{" "}
            {memberRefs.length} member{memberRefs.length === 1 ? "" : "s"}
          </p>
        </div>

        <ProjectPills {...pillState} tagOptions={tagOptions} />
      </header>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <AlertCircleIcon className="mr-1.5 inline size-4 shrink-0" />
          {error}
        </p>
      )}

      <Tabs value={tab} onValueChange={setTab} className="flex flex-col gap-6">
        <TabsSwitcher
          value={tab}
          tabs={[
            { value: "overview", label: "Overview" },
            { value: "activities", label: "Activities" },
          ]}
        />

        <TabsContent value="overview">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="flex flex-col gap-8">
              {/* Status is deliberately absent: the right column's Status row
                  already shows it, next to the pill that edits it. Repeating it
                  here put the same value on screen twice with no new
                  information. */}
              <dl className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
                <Stat label="Start" value={project.startDate} />
                <Stat label="Deadline" value={project.deadline} />
                <Stat label="Created" value={project.createdAt} />
              </dl>

              {selectedTags.length > 0 && (
                <ul className="flex flex-wrap items-center gap-2">
                  {selectedTags.map((tag) => (
                    <li
                      key={tag.id ?? tag.label}
                      className="flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs"
                    >
                      <TagDot color={tag.color} />
                      {tag.label}
                    </li>
                  ))}
                </ul>
              )}

              {/* Description last, and borderless — the treatment the create
                  form uses for "the thing being written", inverted here for
                  "the thing being read". */}
              <ProjectDescription
                description={project.description}
                canEdit={canEdit}
                saving={pills.description.isPending}
                onSave={(body) => pills.description.mutate(body)}
              />
            </div>

            <aside className="lg:sticky lg:top-4 lg:self-start">
              <ProjectProperties
                project={project}
                members={members}
                memberRefs={memberRefs}
                tagOptions={tagOptions}
                selectedTags={selectedTags}
                canEdit={canEdit}
                saving={pills.isPending}
                pills={pillState}
                onInviteClick={canEdit ? () => setInviteOpen(true) : undefined}
              />
            </aside>
          </div>
        </TabsContent>

        <TabsContent value="activities">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="flex flex-col gap-4">
              <UpdateComposer
                workspaceId={workspaceId}
                projectId={project.id}
              />

              {updates.isPending && (
                <p className="text-sm text-muted-foreground">
                  Loading updates…
                </p>
              )}

              {updates.error && (
                <p role="alert" className="text-sm text-destructive">
                  Could not load updates.
                </p>
              )}

              {updates.data?.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No updates yet. Post the first one above.
                </p>
              )}

              {updates.data?.map((update) => (
                <UpdateCard
                  // Keyed on id: an optimistic row and its real replacement
                  // have different ids, so this is one remount per post. The
                  // grid avoided that by keying on slug; here the card holds
                  // no state, so the swap is not visible and paying for a
                  // client-side key column would not be worth it.
                  key={update.id}
                  update={update}
                />
              ))}
            </div>

            <aside className="lg:sticky lg:top-4 lg:self-start">
              <ProjectProperties
                project={project}
                members={members}
                memberRefs={memberRefs}
                tagOptions={tagOptions}
                selectedTags={selectedTags}
                canEdit={canEdit}
                saving={pills.isPending}
                pills={pillState}
                onInviteClick={canEdit ? () => setInviteOpen(true) : undefined}
              />
            </aside>
          </div>
        </TabsContent>
      </Tabs>

      <InviteMemberDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        workspaceId={workspaceId}
        projectId={project.id}
        projectTitle={project.title}
      />
    </div>
  )
}

function Stat({
  label,
  value,
}: {
  label: string
  value: string | Date | null
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">
        {value ? (
          formatValue(value)
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </dd>
    </div>
  )
}

function formatValue(value: string | Date) {
  if (value instanceof Date) {
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(value)
  }
  return value.replace(/_/g, " ")
}
