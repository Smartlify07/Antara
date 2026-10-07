import { sql } from "drizzle-orm"
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { membershipStatus, projectStatus } from "../enums"
import { user } from "./auth"
import { id } from "./shared"
import { roles, workspaces } from "./workspaces"

export const projects = pgTable(
  "projects",
  {
    id: id(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    status: projectStatus("status").notNull().default("planning"),
    startDate: timestamp("start_date"),
    deadline: timestamp("deadline"),
    // CSS-ready oklch stops for the card artwork. Null falls back to the
    // slug-derived monochrome treatment.
    gradientStart: text("gradient_start"),
    gradientEnd: text("gradient_end"),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    // Soft delete (trash). NULL = live.
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [
    // Project slugs are unique per workspace and immutable.
    uniqueIndex("projects_workspace_slug_unique")
      .on(t.workspaceId, t.slug)
      .where(sql`${t.deletedAt} IS NULL`),
    index("projects_workspace_idx").on(t.workspaceId),
    // Backs the overview "active projects" count and future list filters.
    index("projects_workspace_status_idx")
      .on(t.workspaceId, t.status)
      .where(sql`${t.deletedAt} IS NULL`),
  ]
)

export const projectMembers = pgTable(
  "project_members",
  {
    id: id(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    // Nullable, same invitee pattern as team. Exactly one set.
    userId: text("user_id").references(() => user.id, {
      onDelete: "cascade",
    }),
    email: text("email"),
    // Project-scoped role only. Independent of the workspace role.
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "restrict" }),
    status: membershipStatus("status").notNull().default("active"),
    addedBy: text("added_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    check(
      "project_members_user_or_email",
      sql`${t.userId} IS NOT NULL OR ${t.email} IS NOT NULL`
    ),
    uniqueIndex("project_members_project_user_unique")
      .on(t.projectId, t.userId)
      .where(sql`${t.userId} IS NOT NULL`),
    uniqueIndex("project_members_project_email_unique")
      .on(t.projectId, t.email)
      .where(sql`${t.userId} IS NULL AND ${t.email} IS NOT NULL`),
    index("project_members_project_idx").on(t.projectId),
  ]
)

export type Project = typeof projects.$inferSelect
export type ProjectMember = typeof projectMembers.$inferSelect
