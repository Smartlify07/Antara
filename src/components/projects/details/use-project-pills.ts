import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useCallback, useState } from "react"
import {
  addProjectMembersFn,
  setProjectDatesFn,
  setProjectDescriptionFn,
  setProjectLeadFn,
  setProjectStatusFn,
  setProjectTagsFn,
  setProjectTitleFn,
} from "@/server/functions/projects"
import { projectKeys } from "@/lib/queries/projects"
import type { SelectedTag } from "@/components/projects/tags-chip"
import type {
  AssignableMember,
  ProjectDetail,
  ProjectMemberRef,
} from "@/server/services/project-service"
import type { ProjectStatus } from "@/db/enums"

/**
 * Attribute edits for the details page.
 *
 * Each pill writes through immediately rather than staging into local state
 * the way the create form does, because there the project does not exist yet.
 * Here it does, and the grid behind this page holds its own copy, so writes
 * patch the detail cache immediately and then always refetch. The optimistic
 * step is a latency optimisation, not a second source of truth — the server's
 * response replaces it either way.
 */
export function useProjectPills({
  workspaceId,
  project,
  allMembers,
  onError,
}: {
  workspaceId: string
  project: ProjectDetail
  /** Every workspace member, used to resolve a teamId to a person. */
  allMembers: AssignableMember[]
  onError: (message: string | null) => void
}) {
  const client = useQueryClient()
  const [pendingKey, setPendingKey] = useState<string | null>(null)

  const detailKey = projectKeys.detail(workspaceId, project.slug)
  const scope = { workspaceId, projectId: project.id }

  /**
   * One attribute write. `optimistic` patches the detail cache so the pill
   * reflects the new value without waiting for the round trip.
   */
  function write<TVars>(
    key: string,
    run: (variables: TVars) => Promise<unknown>,
    optimistic?: (current: ProjectDetail, variables: TVars) => ProjectDetail
  ) {
    return useMutation({
      mutationKey: [key],
      mutationFn: (variables: TVars) => run(variables),
      onMutate: async (variables) => {
        onError(null)
        await client.cancelQueries({ queryKey: detailKey })
        const snapshot = client.getQueryData<ProjectDetail>(detailKey)
        if (snapshot && optimistic) {
          client.setQueryData(detailKey, optimistic(snapshot, variables))
        }
        setPendingKey(key)
        return { snapshot }
      },
      onError: (error, _variables, context) => {
        if (context?.snapshot) {
          client.setQueryData(detailKey, context.snapshot)
        }
        onError(
          error instanceof Error ? error.message : "Something went wrong."
        )
      },
      onSettled: async () => {
        setPendingKey(null)
        await client.invalidateQueries({ queryKey: detailKey })
        // Every card shows status and member count, so the grid refetches
        // alongside the detail or the two disagree after an edit.
        await client.invalidateQueries({
          queryKey: projectKeys.list(workspaceId),
        })
      },
    })
  }

  const status = write<ProjectStatus>(
    "status",
    (next) => setProjectStatusFn({ data: { ...scope, status: next } }),
    (current, next) => ({ ...current, status: next })
  )

  const lead = write<string | null>(
    "lead",
    (teamId) => setProjectLeadFn({ data: { ...scope, teamId } }),
    (current, teamId) => ({
      ...current,
      members: applyLead(current.members, allMembers, teamId),
    })
  )

  // Appending the new rows from the workspace member list is enough: the
  // service resolves each `team` row to a membership, so the shape the chip
  // reads is the shape the response will contain.
  const members = write<string[]>(
    "members",
    (teamIds) => addProjectMembersFn({ data: { ...scope, teamIds } }),
    (current, teamIds) => ({
      ...current,
      members: [
        ...current.members,
        ...addedMembers(current.members, allMembers, teamIds),
      ],
    })
  )

  const dates = write<{ startDate: Date | null; deadline: Date | null }>(
    "dates",
    (next) => setProjectDatesFn({ data: { ...scope, ...next } }),
    (current, next) => ({ ...current, ...next })
  )

  // The chip replaces the whole tag set, so the patch is a replacement too.
  // New labels have no server id yet and render with the neutral dot until the
  // refetch gives them one — same as the optimistic project row in the grid.
  const tags = write<SelectedTag[]>(
    "tags",
    (next) =>
      setProjectTagsFn({
        data: {
          ...scope,
          tagIds: next.flatMap((tag) => (tag.id ? [tag.id] : [])),
          newTagLabels: next.flatMap((tag) => (tag.id ? [] : [tag.label])),
        },
      }),
    (current, next) => ({
      ...current,
      tags: next.map((tag) => ({
        // A placeholder id stands in for the row the server is about to
        // create, so React has a stable key across the swap.
        id: tag.id ?? `optimistic-tag-${tag.label}`,
        label: tag.label,
        color: tag.color,
      })),
    })
  )

  const title = write<string>(
    "title",
    (next) => setProjectTitleFn({ data: { ...scope, title: next } }),
    (current, next) => ({ ...current, title: next })
  )

  const description = write<string>(
    "description",
    (body) =>
      setProjectDescriptionFn({ data: { ...scope, description: body } }),
    (current, body) => ({ ...current, description: body || null })
  )

  /**
   * Removal is deliberately not implemented — the create form is one-way too.
   * Surfacing that rather than silently ignoring the toggle, which would look
   * like a dropped click.
   */
  const handleMembersToggle = useCallback(
    (teamId: string) => {
      const already = project.members.some((member) => member.teamId === teamId)
      if (already) {
        onError("Removing project members is not built yet.")
        return
      }
      members.mutate([teamId])
    },
    [project.members, members, onError]
  )

  return {
    status,
    lead,
    members,
    dates,
    tags,
    title,
    description,
    handleLeadChange: lead.mutate,
    handleMembersToggle,
    pendingKey,
    isPending:
      status.isPending ||
      lead.isPending ||
      members.isPending ||
      dates.isPending ||
      tags.isPending ||
      title.isPending ||
      description.isPending,
  }
}

/**
 * Resolves newly-added `team` ids into project membership rows, skipping
 * anyone already on the project so a double-add cannot show them twice.
 */
function addedMembers(
  current: ProjectMemberRef[],
  all: AssignableMember[],
  teamIds: string[]
): ProjectMemberRef[] {
  return teamIds.flatMap((teamId) => {
    if (current.some((member) => member.teamId === teamId)) return []
    const person = all.find((member) => member.teamId === teamId)
    if (!person) return []
    return [
      {
        teamId: person.teamId,
        name: person.name,
        email: person.email,
        image: person.image,
        joined: person.joined,
        isLead: false,
      },
    ]
  })
}

/**
 * Mirrors `handleLeadChange` in the create form: setting a lead takes them out
 * of the member list, and clearing it demotes the previous lead to a plain
 * member rather than dropping their project access.
 */
function applyLead(
  current: ProjectMemberRef[],
  all: AssignableMember[],
  teamId: string | null
) {
  if (!teamId) {
    return current.map((member) => ({ ...member, isLead: false }))
  }

  const target = all.find((member) => member.teamId === teamId)
  if (!target) return current

  const base = current.some((member) => member.teamId === teamId)
    ? current
    : [...current, { ...target, isLead: true }]

  return base.map((member) => ({ ...member, isLead: member.teamId === teamId }))
}
