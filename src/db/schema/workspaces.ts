import { sql } from "drizzle-orm"
import {
  boolean,
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { membershipStatus, roleScope } from "../enums"
import { user } from "./auth"
import { id } from "./shared"

export const workspaces = pgTable(
  "workspaces",
  {
    id: id(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    avatarUrl: text("avatar_url"),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    // Set when the owner "leaves": access goes dormant, nothing is destroyed.
    ownerLeftAt: timestamp("owner_left_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    // Soft delete (trash). NULL = live.
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [
    // Slugs are unique per owner and immutable (no update path in the app).
    uniqueIndex("workspaces_owner_slug_unique")
      .on(t.ownerId, t.slug)
      .where(sql`${t.deletedAt} IS NULL`),
    index("workspaces_owner_idx").on(t.ownerId),
  ]
)

export const roles = pgTable(
  "roles",
  {
    id: id(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    scope: roleScope("scope").notNull(),
    // Titles are intentionally NOT unique per workspace.
    title: text("title").notNull(),
    // Seeded system roles (admin/member/lead) cannot be deleted.
    isSystem: boolean("is_system").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("roles_workspace_idx").on(t.workspaceId, t.scope)]
)

export const team = pgTable(
  "team",
  {
    id: id(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    // Nullable: invited-but-not-joined people have no user row yet.
    // Backfilled by email on signup. Exactly one of userId/email is set.
    userId: text("user_id").references(() => user.id, {
      onDelete: "cascade",
    }),
    email: text("email"),
    // Workspace-scoped role only.
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "restrict" }),
    status: membershipStatus("status").notNull().default("active"),
    invitedAt: timestamp("invited_at"),
    // NULL = invited, hasn't joined yet.
    joinedAt: timestamp("joined_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    check(
      "team_user_or_email",
      sql`${t.userId} IS NOT NULL OR ${t.email} IS NOT NULL`
    ),
    uniqueIndex("team_workspace_user_unique")
      .on(t.workspaceId, t.userId)
      .where(sql`${t.userId} IS NOT NULL`),
    uniqueIndex("team_workspace_email_unique")
      .on(t.workspaceId, t.email)
      .where(sql`${t.userId} IS NULL AND ${t.email} IS NOT NULL`),
    index("team_workspace_idx").on(t.workspaceId),
  ]
)

export const workspaceInvites = pgTable(
  "workspace_invites",
  {
    id: id(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "restrict" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    invitedBy: text("invited_by").references(() => user.id, {
      onDelete: "set null",
    }),
    acceptedAt: timestamp("accepted_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("workspace_invites_workspace_idx").on(t.workspaceId),
    index("workspace_invites_email_idx").on(t.email),
  ]
)

export type Workspace = typeof workspaces.$inferSelect
export type Role = typeof roles.$inferSelect
export type TeamMembership = typeof team.$inferSelect
export type WorkspaceInvite = typeof workspaceInvites.$inferSelect
