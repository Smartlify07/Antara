import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { commentSubject } from "../enums"
import { user } from "./auth"
import { id } from "./shared"
import { workspaces } from "./workspaces"

/**
 * The unified comment thread (PRD §9.1): one table, one permission path, one
 * query surface, regardless of what is being discussed — a task, a request
 * under triage, a deliverable, or a version under review (FR-027 feedback).
 *
 * Replaces the per-task `comments` table; tasks' rows migrated in with
 * subject_type='task'. Finding the workspace is a property of the SUBJECT —
 * carried denormalized here so a comment list never needs a subject join just
 * to check access.
 */
export const comments = pgTable(
  "comments",
  {
    id: id(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    // Set-null, per actor convention: an erased account's comments stay.
    authorId: text("author_id").references(() => user.id, {
      onDelete: "set null",
    }),
    subjectType: commentSubject("subject_type").notNull(),
    subjectId: text("subject_id").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    // Every read is "the thread on this subject, oldest first".
    index("comments_subject_idx").on(t.subjectType, t.subjectId, t.createdAt),
    // Notifications/dashboards collect a person's recent comments.
    index("comments_author_idx").on(t.authorId),
  ]
)

export type Comment = typeof comments.$inferSelect
