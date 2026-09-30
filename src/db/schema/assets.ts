import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { assetProvider, deletionJobStatus } from "../enums"
import { user } from "./auth"
import { projects } from "./projects"
import { id } from "./shared"
import { comments, tasks } from "./tasks"

// Every asset lives in exactly one project (permission/listing scope).
// task_id / comment_id are optional context, unconstrained by design.
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
    commentId: text("comment_id").references(() => comments.id, {
      onDelete: "cascade",
    }),
    uploadedBy: text("uploaded_by").references(() => user.id, {
      onDelete: "set null",
    }),
    provider: assetProvider("provider").notNull(),
    // Provider-side key for deletion (Cloudinary public_id / S3 key).
    providerKey: text("provider_key").notNull(),
    url: text("url").notNull(),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("assets_project_idx").on(t.projectId, t.createdAt),
    index("assets_task_idx").on(t.taskId),
    index("assets_comment_idx").on(t.commentId),
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

export type Asset = typeof assets.$inferSelect
export type StorageDeletionJob = typeof storageDeletionQueue.$inferSelect
