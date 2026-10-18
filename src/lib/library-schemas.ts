import { z } from "zod"

/**
 * Validation for the Library (FR-039..044, plan's Increment 6). The library
 * is read-only — these shapes only describe what a viewer may ASK for; the
 * service scopes every answer to the workspace's live projects.
 */

/** The asset-level approval states the PRD names for library filtering. */
export const LIBRARY_APPROVAL_STATES = [
  "approved",
  "not_approved",
  "superseded",
] as const

export type LibraryApprovalState = (typeof LIBRARY_APPROVAL_STATES)[number]

/** The one state word the library knows — or nothing. */
export function parseApprovalState(
  value: string | undefined
): LibraryApprovalState | undefined {
  return LIBRARY_APPROVAL_STATES.find((state) => state === value)
}

/**
 * The list filters. Every field is optional; an absent field means "no
 * filter". The service and the URL search params share this vocabulary:
 * `parseLibrarySearch` produces exactly these values from the URL.
 */
export const libraryFiltersSchema = z
  .object({
    workspaceId: z.string().min(1),
    /** Filename / metadata search. Empty or whitespace means "no search". */
    q: z.string().trim().max(120).optional(),
    /** Exact asset type, chosen from the workspace's own facet values. */
    assetType: z.string().trim().min(1).max(80).optional(),
    projectId: z.string().min(1).optional(),
    // Assets scope themselves through their project, so a deliverable filter
    // without its project has no honest meaning — the client keeps the pair
    // together, and this refine makes the contract explicit at the boundary.
    deliverableId: z.string().min(1).optional(),
    approvalState: z.enum(LIBRARY_APPROVAL_STATES).optional(),
  })
  .refine((data) => !data.deliverableId || Boolean(data.projectId), {
    message: "Pick a project together with the deliverable filter.",
    path: ["deliverableId"],
  })

export type LibraryFiltersInput = z.infer<typeof libraryFiltersSchema>

/** The one asset whose detail page is requested (FR-041/042). */
export const libraryAssetRefSchema = z.object({
  workspaceId: z.string().min(1),
  assetId: z.string().min(1),
})

export type LibraryAssetRefInput = z.infer<typeof libraryAssetRefSchema>

/** The list's URL vocabulary, one word per filter, so links stay short. */
export interface LibrarySearchParams {
  q?: string
  type?: string
  project?: string
  deliverable?: string
  state?: LibraryApprovalState
}

/**
 * The route's `validateSearch`. Unknown or malformed params fall open rather
 * than hard-failing navigation: a stale bookmark with a removed filter value
 * still opens the library — it just opens it without that filter.
 */
export function parseLibrarySearch(
  search: Record<string, unknown>
): LibrarySearchParams {
  const param = (key: string): string | undefined => {
    const value = search[key]
    if (typeof value !== "string") return undefined
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : undefined
  }

  const state = param("state")
  return {
    q: param("q"),
    type: param("type"),
    project: param("project"),
    deliverable: param("deliverable"),
    state: parseApprovalState(state),
  }
}
