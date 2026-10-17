import { sql } from "drizzle-orm"
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import {
  assetProvider,
  assetVersionSource,
  deletionJobStatus,
  updateKind,
  versionReviewStatus,
} from "../enums"
import { user } from "./auth"
import { deliverables } from "./deliverables"
import { projects } from "./projects"
import { id } from "./shared"
import { tasks } from "./tasks"

export const projectUpdates = pgTable(
  "project_updates",
  {
    id: id(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    authorId: text("author_id").references(() => user.id, {
      onDelete: "set null",
    }),
    body: text("body").notNull(),
    // Comment or progress update. Defaults to a comment so any post written
    // before this column existed reads as the quieter of the two.
    //
    // Decisions no longer live here. Review and approval attach to the asset
    // VERSION they were about (asset_versions.review_status + approvals) — a
    // post carrying four attachments was one decision about four files, which
    // is exactly the version/approval ambiguity the PRD (§8.2) forbids.
    kind: updateKind("kind").notNull().default("comment"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("project_updates_project_idx").on(t.projectId, t.createdAt)]
)

/**
 * The logical file within a project — the thing that has a name and a version
 * history. The bytes live on `asset_versions`, so re-uploading a revised file
 * adds a row instead of orphaning the previous one.
 */
export const assets = pgTable(
  "assets",
  {
    id: id(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    taskId: text("task_id").references(() => tasks.id, {
      onDelete: "cascade",
    }),
    // The deliverable this asset belongs to, when the project organizes work
    // that way. Set-null: deleting a deliverable must not orphan-delete the
    // files — they stay attached to the project and remain in the Library.
    deliverableId: text("deliverable_id").references(() => deliverables.id, {
      onDelete: "set null",
    }),
    filename: text("filename").notNull(),
    // Free-text classification for Library filtering (PRD FR-041). Typed
    // categories are deferred until the categories open question resolves.
    assetType: text("asset_type"),
    // Library filter tags. A text array rather than a join table keeps the
    // first Library increment cheap; a tags table arrives if/when querying
    // needs it to.
    tags: text("tags").array(),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("assets_project_idx").on(t.projectId),
    index("assets_task_idx").on(t.taskId),
    index("assets_deliverable_idx").on(t.deliverableId),
    // One logical file per name per project. Case-insensitive so
    // `Keynotes.pdf` and `keynotes.pdf` are the same asset rather than two
    // histories that can never be compared.
    uniqueIndex("assets_project_filename_unique").on(
      t.projectId,
      sql`lower(${t.filename})`
    ),
  ]
)

export const assetVersions = pgTable(
  "asset_versions",
  {
    id: id(),
    assetId: text("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    updateId: text("update_id")
      .notNull()
      .references(() => projectUpdates.id, { onDelete: "cascade" }),
    versionNo: integer("version_no").notNull(),
    label: text("label").notNull(),
    // How the file arrived. Every upload ever created was an upload, so the
    // default backfills honestly. The storage-cleanup worker MUST enqueue
    // only `upload` rows — an `external_link` points at a file on someone
    // else's storage; deleting through it would be touching a system Antara
    // does not own.
    source: assetVersionSource("source").notNull().default("upload"),
    // Hosted-upload only (NULL on an external link): which storage we indexed
    // the bytes into, our reference to them there, and their address.
    provider: assetProvider("provider"),
    providerKey: text("provider_key"),
    url: text("url").notNull(),
    // For external links: which provider the URL points at ('google_drive',
    // 'dropbox', 'figma', ...). Free text until the first integration is
    // chosen (PRD §17); NULL on an upload, which carries `provider` instead.
    externalProvider: text("external_provider"),
    // A stable provider file ID, when the provider offers one. A URL alone is
    // NOT a reliable identity for the underlying file (PRD §11.2) — this is
    // where the reliable one goes. Also reachable for uploads, where
    // `providerKey` already plays that role.
    externalFileId: text("external_file_id"),
    // What the submitter said when they sent it.
    submitterNotes: text("submitter_notes"),
    // NULL = never submitted for review (an upload attached to the feed without
    // entering the workflow). Review states are described on the enum.
    reviewStatus: versionReviewStatus("review_status"),
    // When this version entered review. Any review status requires one — see
    // the check below.
    submittedAt: timestamp("submitted_at"),
    // Known for uploads; unknown for a pasted link until an integration asks
    // the provider for it. NULL is a value here, not a missing one.
    mimeType: text("mime_type"),
    sizeBytes: integer("size_bytes"),
    // Kept for hosted uploads (the bytes' owner) and reused as the external
    // link's submitter — both are "who put this version forward".
    uploadedBy: text("uploaded_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("asset_versions_asset_version_unique").on(
      t.assetId,
      t.versionNo
    ),
    uniqueIndex("asset_versions_asset_label_unique").on(t.assetId, t.label),
    index("asset_versions_update_idx").on(t.updateId),
    // The Reviews queue (FR-030) is built on this predicate.
    index("asset_versions_review_submitted_idx")
      .on(t.reviewStatus)
      .where(sql`review_status = 'submitted'`),
    // Every version entering review records when it entered.
    check(
      "asset_versions_review_has_submitted_at",
      sql`${t.reviewStatus} IS NULL OR ${t.submittedAt} IS NOT NULL`
    ),
    // A hosted upload must carry its storage references; an external link must
    // carry its link-level identity instead, and never provider keys. Null
    // provider means null provider_key with it — the inverse case (keys without
    // a provider) is not a state worth guarding by check.
    check(
      "asset_versions_source_provider_shape",
      sql`(${t.source} = 'upload' AND ${t.provider} IS NOT NULL AND ${t.providerKey} IS NOT NULL)
          OR (${t.source} = 'external_link' AND ${t.provider} IS NULL AND ${t.providerKey} IS NULL)`
    ),
  ]
)

// Outbox for the background storage-cleanup worker. App code enqueues
// rows in the same transaction that deletes asset rows; the worker
// deletes the provider-side files (never on the request path).
export const storageDeletionQueue = pgTable(
  "storage_deletion_queue",
  {
    id: id(),
    provider: assetProvider("provider").notNull(),
    providerKey: text("provider_key").notNull(),
    assetId: text("asset_id"),
    status: deletionJobStatus("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    nextRetryAt: timestamp("next_retry_at"),
    lastError: text("last_error"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("storage_deletion_queue_status_idx").on(t.status)]
)

export type ProjectUpdate = typeof projectUpdates.$inferSelect
export type Asset = typeof assets.$inferSelect
export type AssetVersion = typeof assetVersions.$inferSelect
export type StorageDeletionJob = typeof storageDeletionQueue.$inferSelect
