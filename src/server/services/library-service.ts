import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  notInArray,
  or,
  sql,
} from "drizzle-orm"
import { db } from "@/db"
import type {
  ApprovalDecision,
  AssetVersionSource,
  VersionReviewStatus,
} from "@/db/enums"
import { approvals } from "@/db/schema/approvals"
import { assetVersions, assets } from "@/db/schema/assets"
import { user } from "@/db/schema/auth"
import { deliverables } from "@/db/schema/deliverables"
import { projects } from "@/db/schema/projects"
import {
  annotateVersionFlags,
  assetApprovalState,
  librarySearchPattern,
} from "./library-scoping"
import { requireWorkAccess } from "./work-access"
import type {
  LibraryApprovalState,
  LibraryFiltersInput,
} from "@/lib/library-schemas"

/**
 * The Library's read lane (FR-039..044, plan's Increment 6).
 *
 * READ-ONLY by design: the record is written by the version and feed lanes;
 * this surface only finds and shows it — search, filters, the version
 * timeline and the append-only decision history. Every read is scoped to the
 * workspace's live projects via the `projects` join (assets carry no
 * workspace column of their own), the same membership gate
 * `requireWorkAccess` gives the deliverable lane. No write path exists here,
 * and none may: anything that mutates an asset goes back through the lane
 * that owns the workflow.
 *
 * Pure contracts (the state derivation, the FR-037 flags, the search
 * pattern) live in `library-scoping.ts` so they stay testable without a
 * database; the SQL below mirrors `assetApprovalState`'s buckets exactly.
 */

// ---------------------------------------------------------------------------
// Read models
// ---------------------------------------------------------------------------

/** "Who put this version forward" / "who decided" — actor convention. */
export interface LibraryPerson {
  name: string | null
  email: string | null
}

/** The newest version, for the list card's summary line and FR-037 flags. */
export interface LibraryVersionSummary {
  id: string
  versionNo: number
  label: string
  reviewStatus: VersionReviewStatus | null
  source: AssetVersionSource
  createdAt: Date
  submitter: LibraryPerson
}

/** One asset row in the filtered list. */
export interface LibraryAssetSummary {
  id: string
  filename: string
  assetType: string | null
  tags: string[] | null
  createdAt: Date
  projectId: string
  projectTitle: string
  projectSlug: string
  deliverableId: string | null
  deliverableTitle: string | null
  versionCount: number
  /** Server-derived, see `assetApprovalState` — the three PRD buckets. */
  approvalState: LibraryApprovalState
  latestVersion: LibraryVersionSummary | null
  /** The newest version that was ever approved; often NOT the latest (FR-037). */
  latestApproved: { id: string; versionNo: number; label: string } | null
}

/** Options for the type facet, and a stable contract for the filter row. */
export interface LibraryFacets {
  assetTypes: string[]
}

export interface LibraryListResult {
  assets: LibraryAssetSummary[]
  facets: LibraryFacets
}

/** One decision row from the append-only `approvals` history (FR-044). */
export interface LibraryApprovalRecord {
  decision: ApprovalDecision
  comment: string | null
  decidedAt: Date
  approver: LibraryPerson
}

/** One version on the detail page's timeline, with its full decision history. */
export interface LibraryVersionDetail {
  id: string
  versionNo: number
  label: string
  source: AssetVersionSource
  url: string
  mimeType: string | null
  sizeBytes: number | null
  /** NULL = never submitted for review — a draft even in the library. */
  reviewStatus: VersionReviewStatus | null
  submittedAt: Date | null
  submitterNotes: string | null
  externalProvider: string | null
  externalFileId: string | null
  createdAt: Date
  submitter: LibraryPerson
  /** Every recorded decision for this exact version, oldest first. */
  decisions: LibraryApprovalRecord[]
  isLatest: boolean
  isLatestApproved: boolean
}

export interface LibraryAssetDetail {
  id: string
  filename: string
  assetType: string | null
  tags: string[] | null
  createdAt: Date
  updatedAt: Date
  project: { id: string; title: string; slug: string }
  deliverable: { id: string; title: string } | null
  approvalState: LibraryApprovalState
  versions: LibraryVersionDetail[]
}

// ---------------------------------------------------------------------------
// Shared scoped fragments
// ---------------------------------------------------------------------------

/**
 * Assets have no workspace column; their scope IS their project's. Both
 * queries here join live projects of this workspace — the one predicate that
 * makes a library row visible at all.
 */
function scopedProjectWhere(workspaceId: string, projectId?: string) {
  return and(
    eq(projects.workspaceId, workspaceId),
    isNull(projects.deletedAt),
    projectId ? eq(assets.projectId, projectId) : undefined
  )
}

/** The asset ids whose versions currently carry the given review status. */
function assetIdsWithStatus(status: VersionReviewStatus) {
  return db
    .select({ assetId: assetVersions.assetId })
    .from(assetVersions)
    .where(eq(assetVersions.reviewStatus, status))
}

/** The asset ids with ANY reviewed version — the complement of "untouched". */
function assetIdsEverReviewed() {
  return db
    .select({ assetId: assetVersions.assetId })
    .from(assetVersions)
    .where(isNotNull(assetVersions.reviewStatus))
}

/**
 * The filter's SQL mirror of `assetApprovalState` — three mutually exclusive
 * buckets over the same version rows a card would derive them from:
 * approved ⟺ ∃ approved; superseded ⟺ ∃ superseded ∧ ¬∃ approved;
 * not_approved ⟺ no version ever entered review.
 */
function approvalStateWhere(state: LibraryApprovalState | undefined) {
  if (!state) return undefined
  if (state === "approved") {
    return inArray(assets.id, assetIdsWithStatus("approved"))
  }
  if (state === "superseded") {
    return and(
      inArray(assets.id, assetIdsWithStatus("superseded")),
      notInArray(assets.id, assetIdsWithStatus("approved"))
    )
  }
  return notInArray(assets.id, assetIdsEverReviewed())
}

/**
 * The metadata search: filename, asset type, the deliverable's title and the
 * asset's tags. All are metadata a library browser would know without
 * opening the file — and the pattern is the escaped, honest `librarySearchPattern`.
 */
function searchWhere(pattern: string) {
  return or(
    ilike(assets.filename, pattern),
    sql`coalesce(${assets.assetType}, '') ILIKE ${pattern}`,
    sql`coalesce(${deliverables.title}, '') ILIKE ${pattern}`,
    sql`EXISTS (SELECT 1 FROM unnest(${assets.tags}) AS tag(val) WHERE tag.val ILIKE ${pattern})`
  )
}

// ---------------------------------------------------------------------------
// The list (FR-039/041: search, type, project / deliverable, approval state)
// ---------------------------------------------------------------------------

/**
 * The workspace's assets under the given filters, most recently touched
 * first. Facets are the workspace's own vocabulary (types in use), scoped to
 * the selected project when one is named so the facet list never offers an
 * option that cannot match.
 */
export async function listLibraryAssets(
  workspaceId: string,
  userId: string,
  filters: LibraryFiltersInput
): Promise<LibraryListResult> {
  // The membership gate comes from the shared work lane; nothing beyond a
  // member's workspace may ever reach these rows.
  await requireWorkAccess(workspaceId, userId)

  const facets = await libraryFacetTypes(workspaceId, filters.projectId)

  const pattern = librarySearchPattern(filters.q ?? "")

  const assetRows = await db
    .select({
      id: assets.id,
      filename: assets.filename,
      assetType: assets.assetType,
      tags: assets.tags,
      createdAt: assets.createdAt,
      projectId: projects.id,
      projectTitle: projects.title,
      projectSlug: projects.slug,
      deliverableId: deliverables.id,
      deliverableTitle: deliverables.title,
    })
    .from(assets)
    .innerJoin(projects, eq(assets.projectId, projects.id))
    .leftJoin(deliverables, eq(assets.deliverableId, deliverables.id))
    .where(
      and(
        scopedProjectWhere(workspaceId, filters.projectId),
        filters.deliverableId
          ? eq(assets.deliverableId, filters.deliverableId)
          : undefined,
        filters.assetType ? eq(assets.assetType, filters.assetType) : undefined,
        pattern ? searchWhere(pattern) : undefined,
        approvalStateWhere(filters.approvalState)
      )
    )
    // "Recently touched" — version submissions bump the asset's updatedAt,
    // so current work floats up without a version-level join.
    .orderBy(desc(assets.updatedAt), asc(assets.id))

  if (assetRows.length === 0) return { assets: [], facets }

  const assetIds = assetRows.map((row) => row.id)

  // Newest version first per asset (the same order the timeline shows). The
  // compose step below derives state and flags from exactly these rows, so
  // the filter and the card cannot ever disagree on what "approved" means.
  const versionRows = await db
    .select({
      id: assetVersions.id,
      assetId: assetVersions.assetId,
      versionNo: assetVersions.versionNo,
      label: assetVersions.label,
      source: assetVersions.source,
      reviewStatus: assetVersions.reviewStatus,
      createdAt: assetVersions.createdAt,
      submitterName: user.name,
      submitterEmail: user.email,
    })
    .from(assetVersions)
    .leftJoin(user, eq(assetVersions.uploadedBy, user.id))
    .where(inArray(assetVersions.assetId, assetIds))
    .orderBy(asc(assetVersions.assetId), desc(assetVersions.versionNo))

  const versionsByAsset = new Map<string, typeof versionRows>()
  for (const row of versionRows) {
    const list = versionsByAsset.get(row.assetId) ?? []
    list.push(row)
    versionsByAsset.set(row.assetId, list)
  }

  return {
    assets: assetRows.map((row) => {
      const versions = versionsByAsset.get(row.id) ?? []
      const latest = versions.at(0)
      const approved = versions.find(
        (version) => version.reviewStatus === "approved"
      )
      return {
        id: row.id,
        filename: row.filename,
        assetType: row.assetType,
        tags: row.tags,
        createdAt: row.createdAt,
        projectId: row.projectId,
        projectTitle: row.projectTitle,
        projectSlug: row.projectSlug,
        deliverableId: row.deliverableId,
        deliverableTitle: row.deliverableTitle,
        versionCount: versions.length,
        approvalState: assetApprovalState(
          versions.map((version) => version.reviewStatus)
        ),
        latestVersion: latest
          ? {
              id: latest.id,
              versionNo: latest.versionNo,
              label: latest.label,
              reviewStatus: latest.reviewStatus,
              source: latest.source,
              createdAt: latest.createdAt,
              submitter: {
                name: latest.submitterName,
                email: latest.submitterEmail,
              },
            }
          : null,
        latestApproved: approved
          ? {
              id: approved.id,
              versionNo: approved.versionNo,
              label: approved.label,
            }
          : null,
      }
    }),
    facets,
  }
}

/** Asset types currently in use in the workspace — or in the named project. */
async function libraryFacetTypes(
  workspaceId: string,
  projectId?: string
): Promise<LibraryFacets> {
  const rows = await db
    .selectDistinct({ assetType: assets.assetType })
    .from(assets)
    .innerJoin(projects, eq(assets.projectId, projects.id))
    .where(
      and(
        scopedProjectWhere(workspaceId, projectId),
        isNotNull(assets.assetType)
      )
    )
    .orderBy(asc(assets.assetType))

  return {
    assetTypes: rows.map((row) => row.assetType as string),
  }
}

// ---------------------------------------------------------------------------
// The detail (FR-040/042/043/044: versions, links, notes, decision history)
// ---------------------------------------------------------------------------

/**
 * One asset's history, newest version first: every version with its source,
 * notes, uploader and review state, and the append-only decisions recorded
 * against it — all rows, not just the last one, because the history the
 * approvals table keeps is the point (an earlier `rejected` followed by an
 * `approved` after re-review must stay visible).
 *
 * Returns null for an unknown id, a soft-deleted project, or someone else's
 * workspace — the caller shows one indistinguishable dead end for all three.
 */
export async function getLibraryAsset(
  workspaceId: string,
  userId: string,
  assetId: string
): Promise<LibraryAssetDetail | null> {
  await requireWorkAccess(workspaceId, userId)

  const rows = await db
    .select({
      id: assets.id,
      filename: assets.filename,
      assetType: assets.assetType,
      tags: assets.tags,
      createdAt: assets.createdAt,
      updatedAt: assets.updatedAt,
      projectId: projects.id,
      projectTitle: projects.title,
      projectSlug: projects.slug,
      deliverableId: deliverables.id,
      deliverableTitle: deliverables.title,
    })
    .from(assets)
    .innerJoin(projects, eq(assets.projectId, projects.id))
    .leftJoin(deliverables, eq(assets.deliverableId, deliverables.id))
    .where(and(eq(assets.id, assetId), scopedProjectWhere(workspaceId)))
    .limit(1)

  if (rows.length === 0) return null
  const row = rows[0]

  const versionRows = await db
    .select({
      id: assetVersions.id,
      versionNo: assetVersions.versionNo,
      label: assetVersions.label,
      source: assetVersions.source,
      url: assetVersions.url,
      mimeType: assetVersions.mimeType,
      sizeBytes: assetVersions.sizeBytes,
      reviewStatus: assetVersions.reviewStatus,
      submittedAt: assetVersions.submittedAt,
      submitterNotes: assetVersions.submitterNotes,
      externalProvider: assetVersions.externalProvider,
      externalFileId: assetVersions.externalFileId,
      createdAt: assetVersions.createdAt,
      submitterName: user.name,
      submitterEmail: user.email,
    })
    .from(assetVersions)
    .leftJoin(user, eq(assetVersions.uploadedBy, user.id))
    .where(eq(assetVersions.assetId, assetId))
    .orderBy(desc(assetVersions.versionNo))

  const versionIds = versionRows.map((versionRow) => versionRow.id)

  const decisionRows =
    versionIds.length > 0
      ? await db
          .select({
            assetVersionId: approvals.assetVersionId,
            decision: approvals.decision,
            comment: approvals.comment,
            decidedAt: approvals.decidedAt,
            approverName: user.name,
            approverEmail: user.email,
          })
          .from(approvals)
          .leftJoin(user, eq(approvals.approverId, user.id))
          .where(inArray(approvals.assetVersionId, versionIds))
          .orderBy(asc(approvals.decidedAt), asc(approvals.id))
      : []

  // All rows per version, oldest first — this is history, not a verdict.
  const decisionsByVersion = new Map<string, LibraryApprovalRecord[]>()
  for (const record of decisionRows) {
    const list = decisionsByVersion.get(record.assetVersionId) ?? []
    list.push({
      decision: record.decision,
      comment: record.comment,
      decidedAt: record.decidedAt,
      approver: { name: record.approverName, email: record.approverEmail },
    })
    decisionsByVersion.set(record.assetVersionId, list)
  }

  const versions = annotateVersionFlags(
    versionRows.map((version) => ({
      id: version.id,
      versionNo: version.versionNo,
      label: version.label,
      source: version.source,
      url: version.url,
      mimeType: version.mimeType,
      sizeBytes: version.sizeBytes,
      reviewStatus: version.reviewStatus,
      submittedAt: version.submittedAt,
      submitterNotes: version.submitterNotes,
      externalProvider: version.externalProvider,
      externalFileId: version.externalFileId,
      createdAt: version.createdAt,
      submitter: {
        name: version.submitterName,
        email: version.submitterEmail,
      },
      decisions: decisionsByVersion.get(version.id) ?? [],
    }))
  )

  return {
    id: row.id,
    filename: row.filename,
    assetType: row.assetType,
    tags: row.tags,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    project: {
      id: row.projectId,
      title: row.projectTitle,
      slug: row.projectSlug,
    },
    deliverable: row.deliverableId
      ? { id: row.deliverableId, title: row.deliverableTitle ?? "" }
      : null,
    approvalState: assetApprovalState(
      versionRows.map((version) => version.reviewStatus)
    ),
    versions,
  }
}
