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
  addOptimisticProject,
  buildOptimisticProject,
  clearOptimisticProject,
  setOptimisticError,
} from "@/lib/optimistic-projects"
import type {
  AssignableMember,
  ProjectTagOption,
} from "@/server/services/project-service"
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
  const [pending, setPending] = useState(false)
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

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (title.trim().length < 2 || pending) return

    setPending(true)
    setError(null)

    // Render the project locally first, then navigate straight to the list
    // so the new card animates in without waiting on the server.
    const placeholder = buildOptimisticProject({
      title: title.trim(),
      description: description.trim(),
      status,
      startDate: dates.startDate,
      deadline: dates.deadline,
      memberCount: memberIds.length + (leadId ? 1 : 0) + 1 /* creator */,
      tags: tags.map((tag, index) => ({
        id: tag.id ?? `optimistic-tag-${index}`,
        label: tag.label,
        color: tag.color,
      })),
    })
    addOptimisticProject(placeholder)

    await navigateWithTransition(() =>
      router.navigate({
        to: "/w/$workspaceSlug/projects",
        params: { workspaceSlug },
      })
    )

    try {
      await createProjectFn({
        data: {
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
      })
      // Refresh first so the real row is present, then drop the placeholder;
      // the grid de-dupes by slug, so the card swaps without jumping.
      await router.invalidate()
      clearOptimisticProject(placeholder.id)
    } catch (e) {
      // Rollback: drop the card and surface why on the list.
      clearOptimisticProject(placeholder.id)
      setOptimisticError(
        e instanceof Error
          ? `Could not create "${title.trim()}". ${e.message}`
          : "Could not create the project."
      )
      await navigateWithTransition(() =>
        router.navigate({
          to: "/w/$workspaceSlug/projects/new",
          params: { workspaceSlug },
        })
      )
    } finally {
      setPending(false)
    }
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
          disabled={pending}
          onClick={() =>
            router.navigate({
              to: "/w/$workspaceSlug/projects",
              params: { workspaceSlug },
            })
          }
        >
          Cancel
        </Button>
        <Button type="submit" disabled={pending || title.trim().length < 2}>
          {pending && <Loader2 className="animate-spin" />}
          {pending ? "Creating…" : "Create project"}
        </Button>
      </div>
    </form>
  )
}
