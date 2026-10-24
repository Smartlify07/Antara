import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  max,
  or,
  sql,
} from "drizzle-orm"
import { db } from "@/db"
import type {
  ApprovalDecision,
  AssetProvider,
  AssetVersionSource,
  VersionReviewStatus,
} from "@/db/enums"
import {
  assetVersions,
  assets,
  projectUpdates,
  storageDeletionQueue,
} from "@/db/schema/assets"
import { approvals } from "@/db/schema/approvals"
import { user } from "@/db/schema/auth"
import { comments } from "@/db/schema/comments"
import { deliverables } from "@/db/schema/deliverables"
import { projectMembers, projects } from "@/db/schema/projects"
import { roles } from "@/db/schema/workspaces"
import {
  canDecideVersion,
  canSubmitVersion,
  canWorkOnTasks,
} from "./work-permissions"
import { getWorkAccess, requireWorkAccess } from "./work-access"
import {
  notifyReviewersOfSubmit,
  notifySubmitterOfDecision,
  notifySubmitterOfFeedback,
} from "./notification-service"
import {
  assertVersionDecidable,
  assertVersionReviewTransition,
} from "./workflow-states"
import { toDeletionQueueEntry } from "./storage-guard"
import type {
  DecideVersionInput,
  SubmitVersionInput,
  VersionFeedbackInput,
} from "@/lib/version-schemas"

/**
 * The version lane (FR-019..030, plan's Increment 4). Files flow into a
 * deliverable as ASSETS — case-insensitive per project — and every submission
 * adds a VERSION row to that asset's history with `source` stamped for both
 * provenance and the deletion guard.
 *
 * The review lifecycle lives on `asset_versions.review_status` (machine:
 * `workflow-states.ts`), decisions are append-only rows in `approvals`
 * mirrored back into the version column in the same transaction, and the
 * cleanup worker never touches an `external_link` reference (`toDeletionQueueEntry`
 * is THE guard — decision #1).
 *
 * Pure authorization questions stay in `work-permissions.ts`; this file is
 * DB work shaped by those answers, in the same split as the deliverable
 * service.
 */

// ---------------------------------------------------------------------------
// Read models
// ---------------------------------------------------------------------------

export interface VersionDecisionRecord {
  decision: ApprovalDecision
  decidedAt: Date
  approverName: string | null
  approverEmail: string | null
}

export interface VersionItem {
  id: string
  versionNo: number
  label: string
  source: AssetVersionSource
  url: string
  mimeType: string | null
  sizeBytes: number | null
  /* NULL = never submitted for review (a draft). */
  reviewStatus: VersionReviewStatus | null
  submittedAt: Date | null
  /** Present with null fields when the account is gone (actor convention). */
  submitter: {
    name: string | null
    email: string | null
    image: string | null
  }
  submitterNotes: string | null
  externalProvider: string | null
  externalFileId: string | null
  createdAt: Date
  /** The newest version of this asset (server-computed, FR-037). */
  isLatest: boolean
  /** The newest version of this asset that was ever approved — often NOT the latest. */
  isLatestApproved: boolean
  /** The live decision (approvals are append-only; latest row wins). */
  decision: VersionDecisionRecord | null
  feedbackCount: number
}

export interface VersionAsset {
  id: string
  filename: string
  versions: VersionItem[]
}

export interface DeliverableVersionsResult {
  assets: VersionAsset[]
  viewer: { canSubmit: boolean; canDecide: boolean }
}

export interface ReviewQueueRow {
  versionId: string
  versionNo: number
  label: string
  filename: string
  source: AssetVersionSource
  url: string
  projectId: string
  projectTitle: string
  projectSlug: string
  deliverableId: string | null
  deliverableTitle: string | null
  submittedAt: Date | null
  submitterName: string | null
  submitterEmail: string | null
}

export interface ReviewViewerState {
  /** Workspace admin, or leads at least one project (FR-030's reviewers). */
  canReview: boolean
  /** Submitted versions awaiting THIS viewer's decisions. */
  count: number
}

export interface VersionThreadMessage {
  id: string
  body: string
  createdAt: Date
  authorId: string | null
  authorName: string | null
  authorEmail: string | null
}

// ---------------------------------------------------------------------------
// Shared scoped fetches
// ---------------------------------------------------------------------------

/** The deliverable, verified live inside the workspace-scoped project. */
async function requireDeliverableScoped(
  workspaceId: string,
  projectId: string,
  deliverableId: string
): Promise<{ id: string; ownerId: string | null }> {
  const rows = await db
    .select({
      id: deliverables.id,
      ownerId: deliverables.ownerId,
    })
    .from(deliverables)
    .innerJoin(projects, eq(deliverables.projectId, projects.id))
    .where(
      and(
        eq(deliverables.id, deliverableId),
        eq(deliverables.projectId, projectId),
        eq(deliverables.workspaceId, workspaceId),
        isNull(projects.deletedAt)
      )
    )
    .limit(1)

  if (rows.length === 0) throw new Error("Deliverable not found.")
  return rows[0]
}

/**
 * The version, verified to live under an asset of the named project — the
 * scope every write and every thread read must pass. The deliverable's owner
 * comes back for the submission authority check.
 */
async function requireVersionScoped(
  workspaceId: string,
  projectId: string,
  versionId: string
): Promise<{
  id: string
  reviewStatus: VersionReviewStatus | null
  source: AssetVersionSource
  provider: AssetProvider | null
  providerKey: string | null
  ownerId: string | null
  /** The account behind the submission (asset_versions.uploaded_by). */
  submitterId: string | null
}> {
  const rows = await db
    .select({
      id: assetVersions.id,
      reviewStatus: assetVersions.reviewStatus,
      source: assetVersions.source,
      provider: assetVersions.provider,
      providerKey: assetVersions.providerKey,
      ownerId: deliverables.ownerId,
      submitterId: assetVersions.uploadedBy,
    })
    .from(assetVersions)
    .innerJoin(assets, eq(assetVersions.assetId, assets.id))
    .innerJoin(projects, eq(assets.projectId, projects.id))
    .leftJoin(deliverables, eq(assets.deliverableId, deliverables.id))
    .where(
      and(
        eq(assetVersions.id, versionId),
        eq(assets.projectId, projectId),
        eq(projects.workspaceId, workspaceId),
        isNull(projects.deletedAt)
      )
    )
    .limit(1)

  if (rows.length === 0) throw new Error("Version not found.")
  return rows[0]
}

/**
 * A coarse label for where a link points, free text per the schema's plan
 * until the first external integration is chosen (PRD §17). Pure and honest:
 * it never claims the underlying FILE is identified.
 */
export function externalProviderFromUrl(url: string): string {
  let host: string
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    return "external"
  }
  if (/(^|\.)google\.(com|net)$/.test(host)) return "google_drive"
  if (/(^|\.)dropbox\.com$/.test(host)) return "dropbox"
  if (/(^|\.)figma\.com$/.test(host)) return "figma"
  if (/(^|\.)notion\.(com|so)$/.test(host)) return "notion"
  return "external"
}

// ---------------------------------------------------------------------------
// Submission (FR-019/020/021/022/023/024)
// ---------------------------------------------------------------------------

/**
 * Records one new version on a deliverable.
 *
 * In the transaction: the asset is found (or created) by case-insensitive
 * filename, a feed post anchors the submission for the activity surface, the
 * version row is written with its `source`-shaped provider fields (the
 * CHECK-constraint contract), and every earlier version of that asset flips
 * to `superseded` — the machine's rule that ANY new submission retires the
 * review state of what came before. The approvals rows of those earlier
 * versions survive untouched; they are the historical record (§8.2/§8.3).
 */
export async function submitVersion(
  workspaceId: string,
  userId: string,
  input: SubmitVersionInput
): Promise<{ id: string }> {
  const access = await requireWorkAccess(workspaceId, userId, input.projectId)
  const deliverable = await requireDeliverableScoped(
    workspaceId,
    input.projectId,
    input.deliverableId
  )

  if (!canSubmitVersion(access.facts, deliverable.ownerId)) {
    throw new Error(
      "Only the deliverable's owner, the project lead, or a workspace admin can submit versions."
    )
  }

  return db.transaction(async (tx) => {
    const existingRows = await tx
      .select({
        id: assets.id,
        deliverableId: assets.deliverableId,
      })
      .from(assets)
      .where(
        and(
          eq(assets.projectId, input.projectId),
          sql`lower(${assets.filename}) = lower(${input.filename})`
        )
      )
      .limit(1)
    let assetId: string | null =
      existingRows.length > 0 ? existingRows[0].id : null
    const existingDeliverableId: string | null | undefined =
      existingRows.length > 0 ? existingRows[0].deliverableId : undefined

    if (
      assetId &&
      existingDeliverableId &&
      existingDeliverableId !== input.deliverableId
    ) {
      // A filename is a file's identity across the project; a clash is a
      // naming mistake, not a reason to merge two histories (the unique
      // index is project-wide by design).
      const ownerRows = await tx
        .select({ title: deliverables.title })
        .from(deliverables)
        .where(eq(deliverables.id, existingDeliverableId))
        .limit(1)
      const otherTitle =
        ownerRows.length > 0 ? ownerRows[0].title : "another deliverable"
      throw new Error(
        `"${input.filename}" already belongs to "${otherTitle}". Pick a different filename.`
      )
    }

    if (assetId && existingDeliverableId === null) {
      // The asset was first created elsewhere (a feed attachment or task);
      // organizing it under this deliverable is an upgrade to its metadata.
      await tx
        .update(assets)
        .set({
          deliverableId: input.deliverableId,
          updatedAt: new Date(),
        })
        .where(eq(assets.id, assetId))
    }

    if (!assetId) {
      const createdRows = await tx
        .insert(assets)
        .values({
          projectId: input.projectId,
          deliverableId: input.deliverableId,
          filename: input.filename,
          createdBy: userId,
        })
        .returning({ id: assets.id })
      if (createdRows.length === 0) {
        throw new Error("Could not create the asset.")
      }
      assetId = createdRows[0].id
    }

    // The feed post anchors the version (asset_versions.update_id is NOT
    // NULL) and keeps the activity surface truthful about what happened.
    const updateRows = await tx
      .insert(projectUpdates)
      .values({
        projectId: input.projectId,
        authorId: userId,
        body:
          input.submitterNotes && input.submitterNotes.length > 0
            ? input.submitterNotes
            : `New version of ${input.filename}.`,
      })
      .returning({ id: projectUpdates.id })
    if (updateRows.length === 0) {
      throw new Error("Could not post the update.")
    }
    const updateId = updateRows[0].id

    // Aggregate select: exactly one row; NULL when the asset has no versions yet.
    const highestRows = await tx
      .select({ value: max(assetVersions.versionNo) })
      .from(assetVersions)
      .where(eq(assetVersions.assetId, assetId))
    const versionNo = (highestRows[0].value ?? 0) + 1

    const versionBase = {
      assetId,
      updateId,
      versionNo,
      label:
        input.label && input.label.length > 0 ? input.label : `v${versionNo}`,
      url: input.url,
      submitterNotes: input.submitterNotes ?? null,
      uploadedBy: userId,
    }
    const versionValues =
      input.source === "upload"
        ? {
            ...versionBase,
            source: "upload" as const,
            provider: input.provider,
            providerKey: input.providerKey,
            mimeType: input.mimeType,
            sizeBytes: input.sizeBytes,
          }
        : {
            ...versionBase,
            source: "external_link" as const,
            provider: null,
            providerKey: null,
            mimeType: null,
            sizeBytes: null,
            externalProvider:
              input.externalProvider && input.externalProvider.length > 0
                ? input.externalProvider
                : externalProviderFromUrl(input.url),
            externalFileId:
              input.externalFileId && input.externalFileId.length > 0
                ? input.externalFileId
                : null,
          }

    const versionRows = await tx
      .insert(assetVersions)
      .values(versionValues)
      .returning({ id: assetVersions.id })
    if (versionRows.length === 0) {
      throw new Error("Could not record the version.")
    }

    // Supersede every earlier review state of THIS asset — in the same
    // transaction as the new submission. Never-submitted drafts (NULL) stay
    // NULL, per `supersededStatusFor`.
    await tx
      .update(assetVersions)
      .set({ reviewStatus: "superseded" })
      .where(
        and(
          eq(assetVersions.assetId, assetId),
          isNotNull(assetVersions.reviewStatus)
        )
      )

    await tx
      .update(assets)
      .set({ updatedAt: new Date() })
      .where(eq(assets.id, assetId))

    return { id: versionRows[0].id }
  })
}

// ---------------------------------------------------------------------------
// Review initiation (FR-026)
// ---------------------------------------------------------------------------

const alreadyInReviewMessage: Record<
  Exclude<VersionReviewStatus, never>,
  string
> = {
  submitted: "That version is already waiting for review.",
  approved: "That version is already approved.",
  rejected:
    "That version was rejected — submit a new version to keep the work moving.",
  changes_requested:
    "That version already went back for changes — submit a new version.",
  superseded: "That version was superseded by a newer one.",
}

/**
 * Sends a never-submitted version into review. NULL → submitted is not a
 * machine transition (a draft has no review state yet) — the guard is the
 * UPDATE's own WHERE, so two people racing to submit leave one winner and
 * one clear refresh.
 */
export async function submitForReview(
  workspaceId: string,
  userId: string,
  input: { projectId: string; versionId: string }
): Promise<void> {
  const access = await requireWorkAccess(workspaceId, userId, input.projectId)
  const version = await requireVersionScoped(
    workspaceId,
    input.projectId,
    input.versionId
  )

  if (!canSubmitVersion(access.facts, version.ownerId)) {
    throw new Error(
      "Only the deliverable's owner, the project lead, or a workspace admin can send this for review."
    )
  }

  if (version.reviewStatus !== null) {
    throw new Error(alreadyInReviewMessage[version.reviewStatus])
  }

  const moved = await db
    .update(assetVersions)
    .set({ reviewStatus: "submitted", submittedAt: new Date() })
    .where(
      and(
        eq(assetVersions.id, input.versionId),
        isNull(assetVersions.reviewStatus)
      )
    )
    .returning({ id: assetVersions.id })

  if (moved.length === 0) {
    throw new Error(
      "This version's review just changed — refresh and try again."
    )
  }

  // The waiting reviewers' bell (FR-047d): the project's leads plus the
  // workspace's admins, i.e. exactly the people `canDecideVersion` admits.
  void notifyReviewersOfSubmit(
    workspaceId,
    input.projectId,
    input.versionId,
    userId
  )
}

// ---------------------------------------------------------------------------
// Decisions (FR-032..035)
// ---------------------------------------------------------------------------

/**
 * Records a decision on a submitted version, inside the state machine.
 *
 * approve/reject write an append-only `approvals` row AND mirror into the
 * version column in one transaction; changes_requested is only the version
 * column (approvals holds verdicts — an outcome, not an approval). The
 * UPDATE carries the version's current review_status in its WHERE clause:
 * the race guard the machine's docstring demands.
 */
export async function decideVersion(
  workspaceId: string,
  userId: string,
  input: DecideVersionInput
): Promise<void> {
  const access = await requireWorkAccess(workspaceId, userId, input.projectId)
  const version = await requireVersionScoped(
    workspaceId,
    input.projectId,
    input.versionId
  )

  if (!canDecideVersion(access.facts)) {
    throw new Error(
      "Only the project lead or a workspace admin can decide this version."
    )
  }

  // `superseded` cannot take a decision, whatever the form said. The
  // snapshot lands in a const first: a closure can't carry the narrowing
  // down from the throw above, and the guarded UPDATE re-checks it by value.
  const currentStatus = version.reviewStatus
  if (currentStatus === null) {
    throw new Error(
      "That version was never sent for review — send it for review first."
    )
  }

  assertVersionDecidable(currentStatus)
  assertVersionReviewTransition(currentStatus, input.decision)

  const nextStatus: VersionReviewStatus = input.decision
  const changeComment =
    input.decision === "changes_requested" && input.comment
      ? input.comment
      : null

  await db.transaction(async (tx) => {
    const moved = await tx
      .update(assetVersions)
      .set({ reviewStatus: nextStatus })
      .where(
        and(
          eq(assetVersions.id, input.versionId),
          eq(assetVersions.reviewStatus, currentStatus)
        )
      )
      .returning({ id: assetVersions.id })

    if (moved.length === 0) {
      throw new Error(
        "This version was just decided by someone else — refresh and try again."
      )
    }

    if (input.decision === "changes_requested") {
      // No approvals row — but a reviewer explaining WHAT to change is
      // feedback and must not evaporate. Same surface the owner reads.
      if (changeComment) {
        await tx.insert(comments).values({
          workspaceId,
          authorId: userId,
          subjectType: "version",
          subjectId: input.versionId,
          body: changeComment,
        })
      }
      return
    }

    await tx.insert(approvals).values({
      workspaceId,
      assetVersionId: input.versionId,
      approverId: userId,
      decision: input.decision,
      comment: input.comment ?? null,
    })
  })

  // The submitter's bell for the landed decision (FR-047f). The decider is
  // dropped by the emitter's self-check, and a gone submitter is a no-op.
  void notifySubmitterOfDecision(
    workspaceId,
    input.versionId,
    version.submitterId,
    userId,
    input.decision
  )
}

// ---------------------------------------------------------------------------
// Feedback (FR-027/028)
// ---------------------------------------------------------------------------

/** Project members weigh in on the submitted version; oldest first. */
export async function addVersionFeedback(
  workspaceId: string,
  userId: string,
  input: VersionFeedbackInput
): Promise<void> {
  const access = await requireWorkAccess(workspaceId, userId, input.projectId)
  if (!canWorkOnTasks(access.facts)) {
    throw new Error("Only project members can leave feedback on this version.")
  }
  const version = await requireVersionScoped(
    workspaceId,
    input.projectId,
    input.versionId
  )

  await db.insert(comments).values({
    workspaceId,
    authorId: userId,
    subjectType: "version",
    subjectId: input.versionId,
    body: input.body,
  })

  // The submitter's bell for new feedback (FR-047e); the person writing it
  // never notifies themself.
  void notifySubmitterOfFeedback(
    workspaceId,
    input.versionId,
    version.submitterId,
    userId
  )
}

export async function listVersionThread(
  workspaceId: string,
  userId: string,
  input: { projectId: string; versionId: string }
): Promise<VersionThreadMessage[]> {
  await requireWorkAccess(workspaceId, userId, input.projectId)
  await requireVersionScoped(workspaceId, input.projectId, input.versionId)

  const rows = await db
    .select({
      id: comments.id,
      body: comments.body,
      createdAt: comments.createdAt,
      authorId: comments.authorId,
      authorName: user.name,
      authorEmail: user.email,
    })
    .from(comments)
    .leftJoin(user, eq(comments.authorId, user.id))
    .where(
      and(
        eq(comments.workspaceId, workspaceId),
        eq(comments.subjectType, "version"),
        eq(comments.subjectId, input.versionId)
      )
    )
    .orderBy(asc(comments.createdAt), asc(comments.id))

  return rows.map((row) => ({
    id: row.id,
    body: row.body,
    createdAt: row.createdAt,
    authorId: row.authorId,
    authorName: row.authorName,
    authorEmail: row.authorEmail,
  }))
}

// ---------------------------------------------------------------------------
// Draft deletion (FR-023's other side) — guarded enqueue
// ---------------------------------------------------------------------------

/**
 * Removes a version that never entered review. Hosted uploads queue their
 * bytes through THE shared guard — an external_link is never enqueued,
 * because the worker must never act on storage Antara does not own. A
 * submitted version never gets here: those are history, superseded by a new
 * submission instead of deleted.
 */
export async function deleteDraftVersion(
  workspaceId: string,
  userId: string,
  input: { projectId: string; versionId: string }
): Promise<void> {
  const access = await requireWorkAccess(workspaceId, userId, input.projectId)
  const version = await requireVersionScoped(
    workspaceId,
    input.projectId,
    input.versionId
  )

  if (!canSubmitVersion(access.facts, version.ownerId)) {
    throw new Error(
      "Only the deliverable's owner, the project lead, or a workspace admin can remove this draft."
    )
  }

  if (version.reviewStatus !== null) {
    throw new Error(
      "Submitted versions are history — supersede them by submitting a new version."
    )
  }

  const decisionRows = await db
    .select({ id: approvals.id })
    .from(approvals)
    .where(eq(approvals.assetVersionId, input.versionId))
    .limit(1)
  if (decisionRows.length > 0) {
    throw new Error(
      "That version already carries a recorded decision and cannot be deleted."
    )
  }

  await db.transaction(async (tx) => {
    const entry = toDeletionQueueEntry({
      id: version.id,
      source: version.source,
      provider: version.provider,
      providerKey: version.providerKey,
    })
    if (entry) {
      await tx.insert(storageDeletionQueue).values([entry])
    }

    // Re-guards the review state inside the delete itself: a decision landing
    // between the read above and this statement stops the write cleanly.
    const deleted = await tx
      .delete(assetVersions)
      .where(
        and(
          eq(assetVersions.id, input.versionId),
          isNull(assetVersions.reviewStatus)
        )
      )
      .returning({ id: assetVersions.id })
    if (deleted.length === 0) {
      throw new Error(
        "This version just entered review — refresh and try again."
      )
    }
  })
}

// ---------------------------------------------------------------------------
// Version timeline (FR-021/022, FR-037 badges)
// ---------------------------------------------------------------------------

/**
 * A deliverable's assets and their version history, newest version first.
 * Latest vs latest-approved are server-computed facts (FR-037) so every
 * client agrees on which is which.
 */
export async function listDeliverableVersions(
  workspaceId: string,
  userId: string,
  input: { projectId: string; deliverableId: string }
): Promise<DeliverableVersionsResult> {
  const access = await requireWorkAccess(workspaceId, userId, input.projectId)
  const deliverable = await requireDeliverableScoped(
    workspaceId,
    input.projectId,
    input.deliverableId
  )

  const viewer = {
    canSubmit: canSubmitVersion(access.facts, deliverable.ownerId),
    canDecide: canDecideVersion(access.facts),
  }

  const assetRows = await db
    .select({ id: assets.id, filename: assets.filename })
    .from(assets)
    .where(
      and(
        eq(assets.projectId, input.projectId),
        eq(assets.deliverableId, input.deliverableId)
      )
    )
    .orderBy(asc(assets.createdAt), asc(assets.id))

  if (assetRows.length === 0) return { assets: [], viewer }

  const versionRows = await db
    .select({
      id: assetVersions.id,
      assetId: assetVersions.assetId,
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
      submitterImage: user.image,
    })
    .from(assetVersions)
    .innerJoin(assets, eq(assetVersions.assetId, assets.id))
    .leftJoin(user, eq(assetVersions.uploadedBy, user.id))
    .where(
      and(
        eq(assets.projectId, input.projectId),
        eq(assets.deliverableId, input.deliverableId)
      )
    )
    .orderBy(desc(assetVersions.versionNo))

  const versionIds = versionRows.map((row) => row.id)

  const approvalRows =
    versionIds.length > 0
      ? await db
          .select({
            assetVersionId: approvals.assetVersionId,
            decision: approvals.decision,
            decidedAt: approvals.decidedAt,
            approverName: user.name,
            approverEmail: user.email,
          })
          .from(approvals)
          .leftJoin(user, eq(approvals.approverId, user.id))
          .where(inArray(approvals.assetVersionId, versionIds))
          .orderBy(asc(approvals.decidedAt), asc(approvals.id))
      : []

  const feedbackCounts =
    versionIds.length > 0
      ? await db
          .select({
            subjectId: comments.subjectId,
            value: count(comments.id),
          })
          .from(comments)
          .where(
            and(
              eq(comments.workspaceId, workspaceId),
              eq(comments.subjectType, "version"),
              inArray(comments.subjectId, versionIds)
            )
          )
          .groupBy(comments.subjectId)
      : []

  // Append-only decisions: the last row per version is the live one.
  const decisionByVersion = new Map<string, VersionDecisionRecord>()
  for (const row of approvalRows) {
    decisionByVersion.set(row.assetVersionId, {
      decision: row.decision,
      decidedAt: row.decidedAt,
      approverName: row.approverName,
      approverEmail: row.approverEmail,
    })
  }
  const feedbackCountByVersion = new Map<string, number>(
    feedbackCounts.map((row) => [row.subjectId, row.value])
  )

  const versionsByAsset = new Map<string, VersionItem[]>()
  for (const row of versionRows) {
    const list = versionsByAsset.get(row.assetId) ?? []
    list.push({
      id: row.id,
      versionNo: row.versionNo,
      label: row.label,
      source: row.source,
      url: row.url,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      reviewStatus: row.reviewStatus,
      submittedAt: row.submittedAt,
      submitter: {
        name: row.submitterName,
        email: row.submitterEmail,
        image: row.submitterImage,
      },
      submitterNotes: row.submitterNotes,
      externalProvider: row.externalProvider,
      externalFileId: row.externalFileId,
      createdAt: row.createdAt,
      isLatest: false,
      isLatestApproved: false,
      decision: decisionByVersion.get(row.id) ?? null,
      feedbackCount: feedbackCountByVersion.get(row.id) ?? 0,
    })
    versionsByAsset.set(row.assetId, list)
  }

  const result: VersionAsset[] = assetRows.map((asset) => {
    const versions = versionsByAsset.get(asset.id) ?? []
    const firstApprovedIndex = versions.findIndex(
      (version) => version.reviewStatus === "approved"
    )
    return {
      id: asset.id,
      filename: asset.filename,
      versions: versions.map((version, index) => ({
        ...version,
        isLatest: index === 0,
        isLatestApproved:
          index === firstApprovedIndex && firstApprovedIndex !== -1,
      })),
    }
  })

  return { assets: result, viewer }
}

// ---------------------------------------------------------------------------
// The Reviews queue (FR-030)
// ---------------------------------------------------------------------------

/**
 * The projects whose submitted versions this viewer may decide: every live
 * project for a workspace admin, else the projects they lead.
 */
async function reviewerProjectIds(
  workspaceId: string,
  userId: string,
  viewerEmail: string | null,
  isWorkspaceAdmin: boolean
): Promise<string[]> {
  if (isWorkspaceAdmin) {
    const rows = await db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(eq(projects.workspaceId, workspaceId), isNull(projects.deletedAt))
      )
    return rows.map((row) => row.id)
  }

  // Mirrors `work-access.resolveMembership`'s member-matching: memberships
  // attach by user id or lowercased email, because invitee-only rows carry
  // just an email until verification backfills the account.
  const rows = await db
    .select({ projectId: projectMembers.projectId, roleTitle: roles.title })
    .from(projectMembers)
    .innerJoin(projects, eq(projectMembers.projectId, projects.id))
    .innerJoin(roles, eq(projectMembers.roleId, roles.id))
    .where(
      and(
        eq(projects.workspaceId, workspaceId),
        isNull(projects.deletedAt),
        eq(projectMembers.status, "active"),
        or(
          eq(projectMembers.userId, userId),
          viewerEmail
            ? sql`lower(${projectMembers.email}) = lower(${viewerEmail})`
            : sql`false`
        )
      )
    )

  return Array.from(
    new Set(
      rows.filter((row) => row.roleTitle === "lead").map((row) => row.projectId)
    )
  )
}

/**
 * The queue, stalest submission first — the operational reading order. Rows
 * surface everything (asset's file, project, deliverable, submitter) so the
 * page links a reviewer to the work's own tab.
 */
export async function listReviewQueue(
  workspaceId: string,
  userId: string
): Promise<ReviewQueueRow[]> {
  const access = await requireWorkAccess(workspaceId, userId)
  const projectIds = await reviewerProjectIds(
    workspaceId,
    userId,
    access.viewerEmail,
    access.facts.isWorkspaceAdmin
  )
  if (projectIds.length === 0) return []

  const rows = await db
    .select({
      versionId: assetVersions.id,
      versionNo: assetVersions.versionNo,
      label: assetVersions.label,
      filename: assets.filename,
      source: assetVersions.source,
      url: assetVersions.url,
      projectId: projects.id,
      projectTitle: projects.title,
      projectSlug: projects.slug,
      deliverableId: deliverables.id,
      deliverableTitle: deliverables.title,
      submittedAt: assetVersions.submittedAt,
      submitterName: user.name,
      submitterEmail: user.email,
    })
    .from(assetVersions)
    .innerJoin(assets, eq(assetVersions.assetId, assets.id))
    .innerJoin(projects, eq(assets.projectId, projects.id))
    .leftJoin(deliverables, eq(assets.deliverableId, deliverables.id))
    .leftJoin(user, eq(assetVersions.uploadedBy, user.id))
    .where(
      and(
        inArray(assets.projectId, projectIds),
        eq(assetVersions.reviewStatus, "submitted")
      )
    )
    .orderBy(asc(assetVersions.submittedAt), asc(assetVersions.id))

  return rows.map((row) => ({
    versionId: row.versionId,
    versionNo: row.versionNo,
    label: row.label,
    filename: row.filename,
    source: row.source,
    url: row.url,
    projectId: row.projectId,
    projectTitle: row.projectTitle,
    projectSlug: row.projectSlug,
    deliverableId: row.deliverableId,
    deliverableTitle: row.deliverableTitle,
    submittedAt: row.submittedAt,
    submitterName: row.submitterName,
    submitterEmail: row.submitterEmail,
  }))
}

/**
 * Sidebar badge + page gate: whether the viewer reviews anything, and how
 * many submissions are waiting across their projects. Stamped server-side
 * like every other viewer fact.
 */
export async function reviewViewerState(
  workspaceId: string,
  userId: string
): Promise<ReviewViewerState> {
  const access = await getWorkAccess(workspaceId, userId)
  if (!access) return { canReview: false, count: 0 }

  if (access.facts.isWorkspaceAdmin) {
    return {
      canReview: true,
      count: await countSubmittedVersions(workspaceId, null),
    }
  }

  const projectIds = await reviewerProjectIds(
    workspaceId,
    userId,
    access.viewerEmail,
    false
  )
  if (projectIds.length === 0) return { canReview: false, count: 0 }

  return {
    canReview: true,
    count: await countSubmittedVersions(workspaceId, projectIds),
  }
}

/** Live count of submitted versions, workspace-wide or across the named projects. */
async function countSubmittedVersions(
  workspaceId: string,
  projectIds: string[] | null
): Promise<number> {
  const rows = await db
    .select({ value: count(assetVersions.id) })
    .from(assetVersions)
    .innerJoin(assets, eq(assetVersions.assetId, assets.id))
    .innerJoin(projects, eq(assets.projectId, projects.id))
    .where(
      and(
        eq(projects.workspaceId, workspaceId),
        isNull(projects.deletedAt),
        eq(assetVersions.reviewStatus, "submitted"),
        projectIds ? inArray(assets.projectId, projectIds) : undefined
      )
    )

  // count() never aggregates to NULL; the query always yields one row.
  return rows[0].value
}
