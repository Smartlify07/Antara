import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useRouter } from "@tanstack/react-router"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { DatesChip } from "@/components/projects/dates-chip"
import { LeadChip, MembersChip } from "@/components/projects/member-chip"
import { StatusChip } from "@/components/projects/status-chip"
import { TagsChip, type SelectedTag } from "@/components/projects/tags-chip"
import { createProjectFn } from "@/server/functions/projects"
import { navigateWithTransition } from "@/lib/navigate-with-transition"
import {
  buildOptimisticProject,
  projectKeys,
  sortProjects,
} from "@/lib/queries/projects"
import type {
  AssignableMember,
  ProjectListItem,
  ProjectTagOption,
} from "@/server/services/project-service"
import type { CreateProjectInput } from "@/lib/project-schemas"
import type { ProjectStatus } from "@/db/enums"

export function ProjectCreateForm({
  workspaceId,
  workspaceSlug,
  members,
  tagOptions,
}: {
  workspaceId: string
  workspaceSlug: string
  members: AssignableMember[]
  tagOptions: ProjectTagOption[]
}) {
  const router = useRouter()
  const client = useQueryClient()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [status, setStatus] = useState<ProjectStatus>("planning")
  const [leadId, setLeadId] = useState<string | null>(null)
  const [memberIds, setMemberIds] = useState<string[]>([])
  const [tags, setTags] = useState<SelectedTag[]>([])
  const [dates, setDates] = useState<{
    startDate: Date | null
    deadline: Date | null
  }>({ startDate: null, deadline: null })
  const [error, setError] = useState<string | null>(null)

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

  // `createProjectFn` takes `{ data }`; unwrapping here means the mutation's
  // own variable type is the plain payload, so onMutate receives the fields
  // rather than an options envelope.
  const mutation = useMutation({
    mutationFn: (variables: CreateProjectInput) =>
      createProjectFn({ data: variables }),
    onMutate: async (variables) => {
      // Put the card in the cache immediately, then go to the list. If the
      // write fails, `onError` restores the snapshot below and the card
      // disappears again — the rollback is the cache, not a separate store
      // that has to be reconciled against real rows.
      await client.cancelQueries({ queryKey: projectKeys.list(workspaceId) })
      const snapshot = client.getQueryData<ProjectListItem[]>(
        projectKeys.list(workspaceId)
      )
      client.setQueryData<ProjectListItem[]>(
        projectKeys.list(workspaceId),
        (current = []) =>
          sortProjects([
            ...current,
            buildOptimisticProject(
              variables,
              new Map(tagOptions.map((tag) => [tag.id, tag]))
            ),
          ])
      )
      return { snapshot }
    },
    onError: (_error, _variables, context) => {
      client.setQueryData(projectKeys.list(workspaceId), context?.snapshot)
    },
    onSettled: () => {
      // Replace the placeholder with the real row. Invalidating the list only —
      // the workspace sidebar, team members and tag options are untouched.
      void client.invalidateQueries({ queryKey: projectKeys.list(workspaceId) })
    },
  })

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    // `mutation.isPending` is the single source of truth for the in-flight
    // state. It was a local `pending` before, which then needed its own
    // reset — and lost it when this handler was rewritten, leaving the form
    // disabled forever after one submit.
    if (title.trim().length < 2 || mutation.isPending) return

    setError(null)

    mutation.mutate(
      {
        workspaceId,
        title: title.trim(),
        description: description.trim(),
        status,
        startDate: dates.startDate,
        deadline: dates.deadline,
        memberIds,
        leadId,
        tagIds: tags.flatMap((tag) => (tag.id ? [tag.id] : [])),
        newTagLabels: tags.flatMap((tag) => (tag.id ? [] : [tag.label])),
      },
      {
        onSuccess: () =>
          navigateWithTransition(() =>
            router.navigate({
              to: "/w/$workspaceSlug/projects",
              params: { workspaceSlug },
            })
          ),
        onError: (e) => {
          // Stay on the form and say why, rather than bouncing to a list that
          // no longer has the card in it.
          setError(
            e instanceof Error
              ? `Could not create "${title.trim()}". ${e.message}`
              : "Could not create the project."
          )
        },
      }
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-xl p-4"
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
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
        <TagsChip options={tagOptions} selected={tags} onChange={setTags} />
        <DatesChip
          startDate={dates.startDate}
          deadline={dates.deadline}
          onChange={setDates}
        />
      </div>

      <div className="border-b" />

      <Textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Add a description…"
        aria-label="Project description"
        maxLength={2000}
        className="min-h-[450px] w-full resize-none border-0 bg-transparent text-sm shadow-none focus-visible:ring-0"
      />

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="ghost"
          disabled={mutation.isPending}
          onClick={() =>
            router.navigate({
              to: "/w/$workspaceSlug/projects",
              params: { workspaceSlug },
            })
          }
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={mutation.isPending || title.trim().length < 2}
        >
          {mutation.isPending && <Loader2 className="animate-spin" />}
          {mutation.isPending ? "Creating…" : "Create project"}
        </Button>
      </div>
    </form>
  )
}
