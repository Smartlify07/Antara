import { useMutation, useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { CircleCheckIcon, FolderIcon, Loader2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { Chip, ChipRemove } from "@/components/projects/chip"
import { DatesChip } from "@/components/projects/dates-chip"
import { LeadChip, MembersChip } from "@/components/projects/member-chip"
import { StatusChip } from "@/components/projects/status-chip"
import { TagsChip } from "@/components/projects/tags-chip"
import type { SelectedTag } from "@/components/projects/tags-chip"
import { PROJECT_STATUS_META } from "@/lib/status-meta"
import { acceptRequestFn } from "@/server/functions/requests"
import {
  assignableMembersQuery,
  projectTagsQuery,
  projectsQuery,
} from "@/lib/queries/projects"
import { useTriageSettled } from "@/components/requests/use-triage-settled"
import type { ProjectStatus } from "@/db/enums"
import type { ProjectListItem } from "@/server/services/project-service"

/**
 * The accept path of the triage toolbar (FR-010): the request becomes work
 * in a project — either one created on the spot or one already in the
 * workspace. The new-project side mirrors the project-create-form pill UI
 * (compressed to modal size); the existing side is a searchable picker in
 * the same chips' visual language. The message posted with the decision is
 * the audit trail (triage writes stamp the decision onto the brief thread
 * server-side).
 */
export function AcceptDialog({
  workspaceId,
  requestId,
}: {
  workspaceId: string
  requestId: string
}) {
  const settled = useTriageSettled()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<"new" | "existing">("new")
  const [projectId, setProjectId] = useState<string | null>(null)
  // New-project state mirrors ProjectCreateForm field-for-field, so accepting
  // into a fresh project offers the same levers as creating one from the list.
  const [projectTitle, setProjectTitle] = useState("")
  const [projectDescription, setProjectDescription] = useState("")
  const [status, setStatus] = useState<ProjectStatus>("planning")
  const [leadId, setLeadId] = useState<string | null>(null)
  const [memberIds, setMemberIds] = useState<string[]>([])
  const [tags, setTags] = useState<SelectedTag[]>([])
  const [dates, setDates] = useState<{
    startDate: Date | null
    deadline: Date | null
  }>({ startDate: null, deadline: null })
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)

  function switchMode(candidate: "new" | "existing") {
    setMode(candidate)
    setError(null)
  }

  function toggleMember(teamId: string) {
    setMemberIds((current) =>
      current.includes(teamId)
        ? current.filter((id) => id !== teamId)
        : [...current, teamId]
    )
  }

  function handleLeadChange(next: string | null) {
    setLeadId(next)
    // The lead is stored as a membership, so keep the two lists disjoint.
    if (next) {
      setMemberIds((current) => current.filter((id) => id !== next))
    }
  }

  const { data: projects = [] } = useQuery({
    ...projectsQuery(workspaceId),
    enabled: open,
  })
  const { data: members = [] } = useQuery({
    ...assignableMembersQuery(workspaceId),
    enabled: open,
  })
  const { data: tagOptions = [] } = useQuery({
    ...projectTagsQuery(workspaceId),
    enabled: open,
  })

  const accept = useMutation({
    mutationFn: async () => {
      const destination =
        mode === "existing" && projectId
          ? { projectId }
          : {
              newProjectTitle: projectTitle.trim(),
              newProjectDescription: projectDescription.trim() || undefined,
              newProjectStatus: status,
              newProjectStartDate: dates.startDate,
              newProjectDeadline: dates.deadline,
              newProjectTagIds: tags.flatMap((tag) => (tag.id ? [tag.id] : [])),
              newProjectTagLabels: tags.flatMap((tag) =>
                tag.id ? [] : [tag.label]
              ),
              newProjectMemberIds: memberIds,
              newProjectLeadId: leadId,
            }
      return acceptRequestFn({
        data: {
          workspaceId,
          requestId,
          ...destination,
          note: note.trim() || undefined,
        },
      })
    },
    onSuccess: async () => {
      setOpen(false)
      await settled()
    },
    onError: (mutationError) => {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Could not accept the request."
      )
    },
  })

  function submit() {
    setError(null)
    if (mode === "existing" && !projectId) {
      setError("Pick the project this request becomes work in.")
      return
    }
    // Same floor as the create form: a one-character project title is not
    // a title anyone wanted.
    if (mode === "new" && projectTitle.trim().length < 2) {
      setError("Project title must be at least 2 characters.")
      return
    }
    accept.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        size="sm"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <CircleCheckIcon />
        Accept
      </Button>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Accept into a project</DialogTitle>
          <DialogDescription>
            The request becomes work in a project. This decision is final.
          </DialogDescription>
        </DialogHeader>

        {/* One underlined switch link under the header instead of a
            two-button shouldered tablist: it always names the path you'd
            leave for. Left-aligned in foreground text; plain-button
            semantics on purpose — the label swaps with the mode, so
            aria-pressed would never be true and role="tab" would imply
            tab panels that don't exist. */}
        <button
          type="button"
          className="justify-self-start text-sm text-foreground underline underline-offset-2 transition-colors hover:text-muted-foreground"
          onClick={() => switchMode(mode === "new" ? "existing" : "new")}
        >
          {mode === "new"
            ? "Use an existing project instead"
            : "Create a new project instead"}
        </button>

        {/* Padded div instead of a form onSubmit — the footer button below is
            the only submit affordance and completing the action from here is
            intentionally an explicit click, not an accidental Enter. */}
        <div className="flex flex-col gap-3">
          {mode === "new" ? (
            <>
              {/* The project-create-form pattern, compressed: a big invisible
                  title, one row of pills, a hairline, then the description.
                  The textarea is 200px where the page uses 450px — this is a
                  modal, not the list page. */}
              <input
                value={projectTitle}
                onChange={(event) => setProjectTitle(event.target.value)}
                placeholder="Project title"
                aria-label="Project title"
                maxLength={120}
                autoFocus
                className="w-full bg-transparent text-2xl font-medium tracking-tight outline-none placeholder:text-muted-foreground"
              />

              <div className="flex flex-wrap items-center gap-2">
                <StatusChip status={status} onChange={setStatus} />
                <LeadChip
                  members={members}
                  leadId={leadId}
                  onSelect={handleLeadChange}
                />
                <MembersChip
                  members={members}
                  selectedIds={memberIds}
                  leadId={leadId}
                  onToggle={toggleMember}
                />
                <TagsChip
                  options={tagOptions}
                  selected={tags}
                  onChange={setTags}
                />
                <DatesChip
                  startDate={dates.startDate}
                  deadline={dates.deadline}
                  onChange={setDates}
                />
              </div>

              <div className="border-b" />

              <Textarea
                value={projectDescription}
                onChange={(event) => setProjectDescription(event.target.value)}
                placeholder="Add a description…"
                aria-label="Project description"
                maxLength={2000}
                className="min-h-[200px] w-full resize-none border-0 bg-transparent text-sm shadow-none focus-visible:ring-0"
              />
            </>
          ) : (
            <>
              <ProjectPickChip
                projects={projects}
                value={projectId}
                onSelect={setProjectId}
              />
              {projects.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No projects in this workspace yet —{" "}
                  <button
                    type="button"
                    className="underline underline-offset-2 transition-colors hover:text-foreground"
                    onClick={() => switchMode("new")}
                  >
                    create one instead
                  </button>
                  .
                </p>
              )}
            </>
          )}

          <Field>
            <FieldLabel htmlFor="accept-note">
              Note <span className="text-muted-foreground">(optional)</span>
            </FieldLabel>
            <Textarea
              id="accept-note"
              rows={2}
              placeholder="Posted on the request thread as the decision record."
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </Field>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={accept.isPending}>
            {accept.isPending && <Loader2Icon className="animate-spin" />}
            Accept
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * The chosen project's status icon, tinted from the same status meta the
 * status chip reads, in the filled-pill row treatment.
 */
function ProjectStatusPill({ status }: { status: ProjectStatus }) {
  const meta = PROJECT_STATUS_META[status]
  const Icon = meta.icon
  return (
    <span
      className={`flex size-5 shrink-0 items-center justify-center rounded-full ${meta.badgeClass}`}
    >
      <Icon className="size-3" />
    </span>
  )
}

/**
 * The existing-path destination picker: the tags chip's Command-in-Chip
 * pattern (searchable, keyboard-navigable, single select), with the picked
 * project shown as a removable chosen row above the list. Row meta is the
 * one piece the list already carries for free — the project's status.
 */
function ProjectPickChip({
  projects,
  value,
  onSelect,
}: {
  projects: ProjectListItem[]
  value: string | null
  onSelect: (projectId: string | null) => void
}) {
  const [query, setQuery] = useState("")
  const chosen = projects.find((project) => project.id === value) ?? null
  // Only set once a project is picked; the chip shows its status tint, and
  // the meta comes from the same source the status chip reads.
  const chosenMeta = chosen ? PROJECT_STATUS_META[chosen.status] : null
  const ChosenIcon = chosenMeta?.icon

  const needle = query.trim().toLowerCase()
  const matching = projects.filter(
    (project) =>
      project.id !== value &&
      (!needle || project.title.toLowerCase().includes(needle))
  )

  return (
    <Chip
      placeholder="Pick a destination project…"
      icon={<FolderIcon className="size-3.5 shrink-0" />}
      label={
        chosen && ChosenIcon ? (
          <span className="flex items-center gap-1.5">
            <ChosenIcon
              className={`size-3.5 shrink-0 ${
                PROJECT_STATUS_META[chosen.status].textClass
              }`}
            />
            <span className="truncate">{chosen.title}</span>
          </span>
        ) : undefined
      }
    >
      {chosen && (
        <div className="mb-1 flex flex-col gap-0.5 border-b pb-1">
          <div className="flex items-center gap-2 rounded-md px-2 py-1 text-sm">
            <ProjectStatusPill status={chosen.status} />
            <span className="flex-1 truncate">{chosen.title}</span>
            <ChipRemove label={chosen.title} onClick={() => onSelect(null)} />
          </div>
        </div>
      )}

      <Command shouldFilter={false} className="bg-transparent">
        <CommandInput
          placeholder="Search projects…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>
            {projects.length === 0 ? "No projects yet." : "No projects match."}
          </CommandEmpty>
          <CommandGroup>
            {matching.map((project) => (
              <CommandItem
                key={project.id}
                value={project.id}
                onSelect={() => onSelect(project.id)}
                className="gap-2"
              >
                <ProjectStatusPill status={project.status} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate">{project.title}</span>
                  {project.description && (
                    <span className="truncate text-xs text-muted-foreground">
                      {project.description}
                    </span>
                  )}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </Chip>
  )
}
