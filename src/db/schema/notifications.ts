import { sql } from "drizzle-orm"
import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { user } from "./auth"
import { id } from "./shared"
import { workspaces } from "./workspaces"

/**
 * In-product notifications (PRD FR-047..050). One row per event aimed at one
 * user: work assigned, version needing review, feedback/revision arriving, or
 * an approval decision landing.
 *
 * `type` and `subjectType` are text rather than enums on purpose: the event
 * vocabulary grows with each module, and a text column plus a TypeScript union
 * in the emitter widens without a migration. The polymorphic pair points at
 * the record to jump to; Postgres cannot FK it, and the workspace column is
 * what scopes reads.
 */
export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    // Whose bell this rings. Cascade: an account's notifications are about
    // them — they should not outlive the account.
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // One of the event names the emitter declares ('assigned',
    // 'review_requested', 'feedback', 'decision').
    type: text("type").notNull(),
    // The record to jump to ('task', 'request', 'deliverable', 'asset_version').
    subjectType: text("subject_type").notNull(),
    subjectId: text("subject_id").notNull(),
    // Who caused the event, for the "A. Osei approved …" phrasing. Set-null
    // per the actor convention.
    actorId: text("actor_id").references(() => user.id, {
      onDelete: "set null",
    }),
    // NULL = unread.
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    // The unread badge counter scans this constantly.
    index("notifications_user_unread_idx")
      .on(t.userId)
      .where(sql`read_at IS NULL`),
    // The inbox lists a user's events, newest first.
    index("notifications_user_created_idx").on(t.userId, t.createdAt),
  ]
)

export type Notification = typeof notifications.$inferSelect
