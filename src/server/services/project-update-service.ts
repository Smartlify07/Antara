import { and, desc, eq, inArray, isNull, max, sql } from "drizzle-orm"
import { db } from "@/db"
import {
  assetVersions,
  assets,
  projectMembers,
  projects,
  projectUpdates,
  roles,
  storageDeletionQueue,
  team,
  user,
  workspaces,
} from "@/db/schema/index"
import { requireWorkspaceAccess } from "@/server/services/project-service"
import type { UpdateReviewStatus } from "@/db/enums"

/**
 * Progress updates: the activity feed, the attachments they carry, and the
 * lead's review decision. Pure DB work only — auth lives in the server
 * functions, mirroring `project-service`.
 */

export interface UpdateVersion {
  id: string
  assetId: string
  filename: string
  label: string
  versionNo: number
  url: string
  mimeType: string
  sizeBytes: number
}

export interface ProjectUpdateItem {
  id: string
  body: string
  reviewStatus: UpdateReviewStatus
  reviewNote: string | null
  createdAt: Date
  author: {
    id: string
    name: string | null
    email: string | null
    image: string | null
  }
  reviewer: {
    id: string
    name: string | null
    image: string | null
  } | null
  versions: UpdateVersion[]
}

/** An attachment the browser already pushed to the provider. */
export interface AttachmentInput {
  filename: string
  url: string
  provider: "cloudinary" | "aws"
  providerKey: string
  mimeType: string
  sizeBytes: number
}

/** Newest first — the feed reads as a conversation. */
export async function listProjectUpdates(
  workspaceId: string,
  projectId: string
): Promise<ProjectUpdateItem[]> {
  const rows = await db
    .select({
      id: projectUpdates.id,
      body: projectUpdates.body,
      reviewStatus: projectUpdates.reviewStatus,
      reviewNote: projectUpdates.reviewNote,
      createdAt: projectUpdates.createdAt,
      authorId: user.id,
      authorName: user.name,
      authorEmail: user.email,
      authorImage: user.image,
      reviewerId: projectUpdates.reviewedBy,
      reviewerName: user.name,
      reviewerImage: user.image,
    })
    .from(projectUpdates)
    .innerJoin(projects, eq(projectUpdates.projectId, projects.id))
    .leftJoin(user, eq(projectUpdates.authorId, user.id))
    .where(
      and(
        eq(projects.id, projectId),
        eq(projects.workspaceId, workspaceId),
        isNull(projects.deletedAt)
      )
    )
    .orderBy(desc(projectUpdates.createdAt))

  if (rows.length === 0) return []

  // Two joins on `user` (author and reviewer) collide on column name, so the
  // reviewer is fetched separately rather than aliasing in one query.
  const reviewerIds = rows
    .map((row) => row.reviewerId)
    .filter((id): id is string => Boolean(id))

  const reviewers = reviewerIds.length
    ? await db
        .select({ id: user.id, name: user.name, image: user.image })
        .from(user)
        .where(inArray(user.id, reviewerIds))
    : []

  const reviewerById = new Map(reviewers.map((row) => [row.id, row]))

  const versionRows = await db
    .select({
      id: assetVersions.id,
      assetId: assetVersions.assetId,
      filename: assets.filename,
      label: assetVersions.label,
      versionNo: assetVersions.versionNo,
      url: assetVersions.url,
      mimeType: assetVersions.mimeType,
      sizeBytes: assetVersions.sizeBytes,
      updateId: assetVersions.updateId,
    })
    .from(assetVersions)
    .innerJoin(assets, eq(assetVersions.assetId, assets.id))
    .where(eq(assets.projectId, projectId))
    .orderBy(assetVersions.versionNo)

  const versionsByUpdate = new Map<string, UpdateVersion[]>()
  for (const row of versionRows) {
    const list = versionsByUpdate.get(row.updateId) ?? []
    list.push({
      id: row.id,
      assetId: row.assetId,
      filename: row.filename,
      label: row.label,
      versionNo: row.versionNo,
      url: row.url,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
    })
    versionsByUpdate.set(row.updateId, list)
  }

  return rows.map((row) => {
    const reviewer = row.reviewerId ? reviewerById.get(row.reviewerId) : null
    return {
      id: row.id,
      body: row.body,
      reviewStatus: row.reviewStatus,
      reviewNote: row.reviewNote,
      createdAt: row.createdAt,
      author: {
        id: row.authorId ?? "",
        name: row.authorName,
        email: row.authorEmail,
        image: row.authorImage,
      },
      reviewer: reviewer
        ? { id: reviewer.id, name: reviewer.name, image: reviewer.image }
        : null,
      versions: versionsByUpdate.get(row.id) ?? [],
    }
  })
}

/**
 * Whether the actor may approve a submission: the project's `lead`, or a
 * workspace admin/owner.
 *
 * Leads are project-scope memberships, and admins are workspace-scoped, so
 * both sides are checked. Returns false rather than throwing so the caller can
 * use it to hide the control as well as to reject the write.
 */
export async function canReviewProjectUpdates(
  workspaceId: string,
  userId: string,
  projectId: string
): Promise<boolean> {
  const [owned] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(
      and(
        eq(workspaces.id, workspaceId),
        eq(workspaces.ownerId, userId),
        isNull(workspaces.deletedAt)
      )
    )
    .limit(1)
  if (owned) return true

  // Workspace admin via the actor's own membership row. Joining roles on the
  // workspace alone would find *some* admin and approve for anyone.
  const [workspaceAdmin] = await db
    .select({ id: roles.id })
    .from(team)
    .innerJoin(roles, eq(team.roleId, roles.id))
    .where(
      and(
        eq(team.workspaceId, workspaceId),
        eq(team.userId, userId),
        eq(team.status, "active"),
        eq(roles.scope, "workspace"),
        eq(roles.title, "admin")
      )
    )
    .limit(1)

  if (workspaceAdmin) return true

  const [lead] = await db
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .innerJoin(roles, eq(projectMembers.roleId, roles.id))
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId),
        eq(projectMembers.status, "active"),
        eq(roles.title, "lead")
      )
    )
    .limit(1)

  return Boolean(lead)
}

/**
 * Appends a progress update and files its attachments.
 *
 * Attachments are matched to an existing asset by filename within the project,
 * so re-sending `keynotes.pdf` becomes v2 of the same asset rather than a
 * second, unrelated file. The version number is derived from the current max
 * inside the transaction and the unique index on (asset_id, version_no) is the
 * backstop if two writers race.
 */
export async function createProjectUpdate(
  workspaceId: string,
  userId: string,
  projectId: string,
  body: string,
  attachments: AttachmentInput[]
): Promise<{ id: string }> {
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(
        eq(projects.id, projectId),
        eq(projects.workspaceId, workspaceId),
        isNull(projects.deletedAt)
      )
    )
    .limit(1)

  if (!project) throw new Error("Project not found.")

  return db.transaction(async (tx) => {
    const [update] = await tx
      .insert(projectUpdates)
      .values({ projectId, authorId: userId, body })
      .returning({ id: projectUpdates.id })

    if (!update) throw new Error("Could not post the update.")

    for (const attachment of attachments) {
      const [existing] = await tx
        .select({ id: assets.id })
        .from(assets)
        .where(
          and(
            eq(assets.projectId, projectId),
            sql`lower(${assets.filename}) = lower(${attachment.filename})`
          )
        )
        .limit(1)

      let assetId = existing?.id

      if (!assetId) {
        const [created] = await tx
          .insert(assets)
          .values({
            projectId,
            filename: attachment.filename,
            createdBy: userId,
          })
          .returning({ id: assets.id })
        if (!created) throw new Error("Could not create the asset.")
        assetId = created.id
      }

      const [highest] = await tx
        .select({ value: max(assetVersions.versionNo) })
        .from(assetVersions)
        .where(eq(assetVersions.assetId, assetId))

      const versionNo = (highest?.value ?? 0) + 1

      await tx.insert(assetVersions).values({
        assetId,
        updateId: update.id,
        versionNo,
        label: `v${versionNo}`,
        provider: attachment.provider,
        providerKey: attachment.providerKey,
        url: attachment.url,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        uploadedBy: userId,
      })
    }

    await tx
      .update(assets)
      .set({ updatedAt: new Date() })
      .where(
        and(
          eq(assets.projectId, projectId),
          inArray(
            assets.id,
            sql`(select distinct asset_id from asset_versions where update_id = ${update.id})`
          )
        )
      )

    return { id: update.id }
  })
}

/**
 * Records the lead's decision on a submission.
 *
 * Only a still-pending update can be reviewed, so a second click is a no-op
 * rather than an error — the UI disables the buttons, but the button is not
 * the guard.
 */
export async function reviewProjectUpdate(
  workspaceId: string,
  userId: string,
  projectId: string,
  updateId: string,
  decision: "approved" | "changes_requested",
  note?: string
): Promise<void> {
  const allowed = await canReviewProjectUpdates(workspaceId, userId, projectId)
  if (!allowed) {
    throw new Error("Only the project lead can review submissions.")
  }

  const updated = await db
    .update(projectUpdates)
    .set({
      reviewStatus: decision,
      reviewedBy: userId,
      reviewedAt: new Date(),
      reviewNote: note?.trim() || null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(projectUpdates.id, updateId),
        eq(projectUpdates.projectId, projectId),
        eq(projectUpdates.reviewStatus, "pending")
      )
    )
    .returning({ id: projectUpdates.id })

  if (updated.length === 0) {
    throw new Error("That update has already been reviewed.")
  }
}

/**
 * Enqueues provider-side deletes for an asset's versions. The bytes are not
 * removed on the request path — the worker in `storage_deletion_queue` does
 * that, so a slow provider cannot fail the user's click.
 */
export async function queueAssetDeletion(
  workspaceId: string,
  userId: string,
  projectId: string,
  assetId: string
): Promise<void> {
  await requireWorkspaceAccess(workspaceId, userId)

  const versions = await db
    .select({
      id: assetVersions.id,
      provider: assetVersions.provider,
      providerKey: assetVersions.providerKey,
    })
    .from(assetVersions)
    .innerJoin(assets, eq(assetVersions.assetId, assets.id))
    .where(and(eq(assets.id, assetId), eq(assets.projectId, projectId)))

  if (versions.length === 0) throw new Error("Asset not found.")

  await db.transaction(async (tx) => {
    await tx.insert(storageDeletionQueue).values(
      versions.map((version) => ({
        provider: version.provider,
        providerKey: version.providerKey,
        assetId: version.id,
      }))
    )
    await tx.delete(assets).where(eq(assets.id, assetId))
  })
}
