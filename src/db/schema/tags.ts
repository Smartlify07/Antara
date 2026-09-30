import { sql } from "drizzle-orm"
import {
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { projectMembers } from "./projects"
import { id } from "./shared"
import { workspaces } from "./workspaces"

// Free-floating duty labels (e.g. motion, 3d). No permission meaning.
export const tags = pgTable(
  "tags",
  {
    id: id(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("tags_workspace_label_unique").on(
      t.workspaceId,
      sql`lower(${t.label})`
    ),
  ]
)

export const memberTags = pgTable(
  "member_tags",
  {
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    projectMemberId: text("project_member_id")
      .notNull()
      .references(() => projectMembers.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.tagId, t.projectMemberId] })]
)

export type Tag = typeof tags.$inferSelect
