import { queryOptions } from "@tanstack/react-query"
import {
  getProjectDetailFn,
  listAssignableMembersFn,
  listProjectTagsFn,
  listProjectsFn,
  listProjectUpdatesFn,
} from "@/server/functions/projects"
import { slugifyTitle } from "@/lib/project-schemas"
import type { CreateProjectInput } from "@/lib/project-schemas"
import type {
  ProjectListItem,
  ProjectTagOption,
} from "@/server/services/project-service"
import type { ProjectUpdateItem } from "@/server/services/project-update-service"
import type { UpdateKind } from "@/db/enums"

/**
 * Query keys for projects.
 *
 * Mutations invalidate by prefix rather than calling `router.invalidate()`,
 * which refetched every active loader in the app — archiving one project also
 * refetched the workspace list, team members and the tag options.
 */
export const projectKeys = {
  all: ["projects"] as const,
  list: (workspaceId: string) => ["projects", "list", workspaceId] as const,
  assignableMembers: (workspaceId: string) =>
    ["projects", "members", workspaceId] as const,
  tags: (workspaceId: string) => ["projects", "tags", workspaceId] as const,
  // Keyed by slug, not id: the route resolves the project from the URL and
  // only then learns its id, so an id-keyed query could not be declared until
  // a second round trip had already happened.
  detail: (workspaceId: string, slug: string) =>
    ["projects", "detail", workspaceId, slug] as const,
  updates: (workspaceId: string, projectId: string) =>
    ["projects", "updates", workspaceId, projectId] as const,
}

export function projectsQuery(workspaceId: string) {
  return queryOptions({
    queryKey: projectKeys.list(workspaceId),
    queryFn: () => listProjectsFn({ data: { workspaceId } }),
  })
}

export function assignableMembersQuery(workspaceId: string) {
  return queryOptions({
    queryKey: projectKeys.assignableMembers(workspaceId),
    queryFn: () => listAssignableMembersFn({ data: { workspaceId } }),
  })
}

export function projectTagsQuery(workspaceId: string) {
  return queryOptions({
    queryKey: projectKeys.tags(workspaceId),
    queryFn: () => listProjectTagsFn({ data: { workspaceId } }),
  })
}

/** Null when the slug no longer resolves — a soft-deleted project. */
export function projectDetailQuery(workspaceId: string, slug: string) {
  return queryOptions({
    queryKey: projectKeys.detail(workspaceId, slug),
    queryFn: () =>
      getProjectDetailFn({ data: { workspaceId, projectSlug: slug } }),
  })
}

export function projectUpdatesQuery(workspaceId: string, projectId: string) {
  return queryOptions({
    queryKey: projectKeys.updates(workspaceId, projectId),
    queryFn: () => listProjectUpdatesFn({ data: { workspaceId, projectId } }),
  })
}

/** One ordering rule for the whole list, optimistic rows included. */
export function sortProjects(projects: ProjectListItem[]): ProjectListItem[] {
  return [...projects].sort((a, b) => {
    const aDue = a.deadline ? new Date(a.deadline).getTime() : Infinity
    const bDue = b.deadline ? new Date(b.deadline).getTime() : Infinity
    if (aDue !== bDue) return aDue - bDue
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
}

/**
 * The row rendered between the click and the server's response.
 *
 * The slug has to be the server's, from `slugifyTitle`, not a local
 * approximation. The grid keys cards on slug so a placeholder and its real row
 * swap in place instead of remounting; a slug that disagreed would both break
 * that and let the placeholder outlive its replacement.
 */
/**
 * A placeholder row living in the cache alongside real ones.
 *
 * Structurally a `ProjectListItem` plus a marker, so the grid and card need no
 * special case beyond hiding actions on a row that has no server record yet.
 */
export type OptimisticProject = ProjectListItem & { optimistic: true }

/** Stand-in for a tag the server hasn't coloured yet. */
const NEUTRAL_TAG_COLOUR = "#a3a3a3"

export function buildOptimisticProject(
  input: CreateProjectInput,
  // Labels/colours for existing tags, so a chosen tag doesn't render blank
  // while the placeholder is on screen. New labels have no colour yet — the
  // server derives one — so they fall back to the neutral chip.
  tagLabels: Map<string, ProjectTagOption> = new Map()
): OptimisticProject {
  return {
    id: `optimistic-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    title: input.title,
    slug: slugifyTitle(input.title),
    description: input.description || null,
    status: input.status,
    startDate: input.startDate ?? null,
    deadline: input.deadline ?? null,
    createdAt: new Date(),
    gradientStart: null,
    gradientEnd: null,
    taskCount: 0,
    memberCount:
      (input.memberIds?.length ?? 0) + (input.leadId ? 1 : 0) + 1 /* creator */,
    commentCount: 0,
    tags: [
      ...(input.tagIds ?? []).flatMap((id) => {
        const tag = tagLabels.get(id)
        return tag ? [{ id, label: tag.label, color: tag.color }] : []
      }),
      ...(input.newTagLabels ?? []).map((label, index) => ({
        id: `optimistic-tag-${index}`,
        label,
        color: NEUTRAL_TAG_COLOUR,
      })),
    ],
    optimistic: true,
  }
}

/**
 * Builds the row rendered between the click and the server's response.
 *
 * The `optimistic-` id prefix is what marks it: the card checks the prefix to
 * decide whether the row can be reviewed yet, and nothing else branches on a
 * placeholder, because it renders identically to a settled post.
 *
 * `localUrl` is the browser object URL for each attachment. Those previews
 * must be revoked by the caller when the placeholder is replaced or rolled
 * back — the grid never made optimistic rows carry blob URLs, so nothing else
 * in the app does this cleanup today.
 */
export type OptimisticUpdate = ProjectUpdateItem
export function buildOptimisticUpdate(input: {
  body: string
  kind: UpdateKind
  author: ProjectUpdateItem["author"]
  attachments: { file: File; url: string }[]
}): OptimisticUpdate {
  const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

  return {
    id: `optimistic-${stamp}`,
    body: input.body,
    kind: input.kind,
    createdAt: new Date(),
    author: input.author,
    versions: input.attachments.map((attachment, index) => ({
      id: `optimistic-version-${stamp}-${index}`,
      // Each pending file is its own asset for now: the real numbering only
      // exists server-side, where filenames are matched against prior assets.
      assetId: `optimistic-asset-${stamp}-${index}`,
      filename: attachment.file.name,
      label: "—",
      versionNo: 0,
      url: attachment.url,
      mimeType: attachment.file.type || "application/octet-stream",
      sizeBytes: attachment.file.size,
    })),
  }
}
