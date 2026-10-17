import { and, desc, eq, inArray, isNull, max, sql } from "drizzle-orm"
import { db } from "@/db"
import {
  assetVersions,
  assets,
  projects,
  projectUpdates,
  storageDeletionQueue,
  user,
} from "@/db/schema/index"
import { requireWorkspaceAccess } from "@/server/services/project-service"
import type { UpdateKind } from "@/db/enums"

/**
 * Progress updates: the activity feed and the attachments it carries. Pure DB
 * work only — auth lives in the server functions, mirroring `project-service`.
 *
 * Decisions do not belong here. Approval attaches to the asset VERSION a post
 * carried (asset_versions.review_status + approvals) — versioning the review
 * so that approving post #2 proves nothing about the same file sent again in
 * post #5. See `version-service` (Increment 4).
 */

export interface UpdateVersion {
  id: string
  assetId: string
  filename: string
  label: string
  versionNo: number
  url: string
  // Known for hosted uploads; NULL for a pasted external link, whose metadata
  // is whatever its provider eventually says.
  mimeType: string | null
  sizeBytes: number | null
}

export interface ProjectUpdateItem {
  id: string
  body: string
  kind: UpdateKind
  createdAt: Date
  author: {
    id: string
    name: string | null
    email: string | null
    image: string | null
  }
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
      kind: projectUpdates.kind,
      createdAt: projectUpdates.createdAt,
      authorId: user.id,
      authorName: user.name,
      authorEmail: user.email,
      authorImage: user.image,
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
    return {
      id: row.id,
      body: row.body,
      kind: row.kind,
      createdAt: row.createdAt,
      author: {
        id: row.authorId ?? "",
        name: row.authorName,
        email: row.authorEmail,
        image: row.authorImage,
      },
      versions: versionsByUpdate.get(row.id) ?? [],
    }
  })
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
  kind: UpdateKind,
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
      .values({
        projectId,
        authorId: userId,
        body,
        kind,
      })
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
 * Enqueues provider-side deletes for an asset's versions. The bytes are not
 * removed on the request path — the worker in `storage_deletion_queue` does
 * that, so a slow provider cannot fail the user's click.
 *
 * Source guard: only versions whose bytes WE host (`source = 'upload'`) may
 * be enqueued. An external_link version points at a file on someone else's
 * storage; running a delete through that reference would reach into a system
 * Antara does not own. The asset row still goes — the queue is about bytes.
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
      source: assetVersions.source,
      provider: assetVersions.provider,
      providerKey: assetVersions.providerKey,
    })
    .from(assetVersions)
    .innerJoin(assets, eq(assetVersions.assetId, assets.id))
    .where(and(eq(assets.id, assetId), eq(assets.projectId, projectId)))

  if (versions.length === 0) throw new Error("Asset not found.")

  await db.transaction(async (tx) => {
    // Narrowed into a typed list first: the upload-shape check and the insert
    // need the same predicate, and TS does not carry a two-property filter
    // narrowing into the map below it.
    const deletable = versions.filter(
      (version) =>
        version.source === "upload" &&
        version.provider !== null &&
        version.providerKey !== null
    )
    await tx.insert(storageDeletionQueue).values(
      deletable.map((version) => ({
        provider: version.provider as "cloudinary" | "aws",
        providerKey: version.providerKey as string,
        // The queue keys on the version row (the bytes), though the column
        // keeps the historical `asset_id` name.
        assetId: version.id,
      }))
    )
    await tx.delete(assets).where(eq(assets.id, assetId))
  })
}
