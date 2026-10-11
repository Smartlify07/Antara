import { sql } from "drizzle-orm"
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import {
  assetProvider,
  deletionJobStatus,
  updateKind,
  updateReviewStatus,
} from "../enums"
import { user } from "./auth"
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
    kind: updateKind("kind").notNull().default("comment"),
    // Nullable because only progress updates are reviewed. A comment has no
    // review lifecycle, so a `pending` row would imply a queue nobody works
    // through. NULL means "not reviewable", which is distinct from "not yet
    // reviewed" — which is what `pending` means on a progress update.
    reviewStatus: updateReviewStatus("review_status"),
    reviewedBy: text("reviewed_by").references(() => user.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at"),
    reviewNote: text("review_note"),
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
    filename: text("filename").notNull(),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("assets_project_idx").on(t.projectId),
    index("assets_task_idx").on(t.taskId),
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
    provider: assetProvider("provider").notNull(),
    providerKey: text("provider_key").notNull(),
    url: text("url").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
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
