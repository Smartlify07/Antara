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
    // When this person last had this workspace open. NULL = never opened.
    // Server-authoritative, so the landing target follows the account across
    // devices. Coalesced client-side by a debounce, so rapid switching
    // doesn't emit a write per hop.
    lastOpenedAt: timestamp("last_opened_at"),
    invitedAt: timestamp("invited_at"),
    // NULL = invited, hasn't joined yet.
    joinedAt: timestamp("joined_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    // Exactly one of the two, not merely at least one. With an OR a row can
    // carry both a user and an email, and the signup backfill then has no
    // single identity to match on.
    check("team_user_or_email", sql`num_nonnulls(${t.userId}, ${t.email}) = 1`),
    uniqueIndex("team_workspace_user_unique")
      .on(t.workspaceId, t.userId)
      .where(sql`${t.userId} IS NOT NULL`),
    // Emails are normalized on write; the case-insensitive lookup is what
    // the signup backfill matches on.
    index("team_email_lower_idx").on(sql`lower(${t.email})`),
    uniqueIndex("team_workspace_email_unique")
      .on(t.workspaceId, t.email)
      .where(sql`${t.userId} IS NULL AND ${t.email} IS NOT NULL`),
    index("team_workspace_idx").on(t.workspaceId),
    // Resolving the landing workspace and listing the switcher both filter on
    // user_id alone. team_workspace_user_unique leads with workspace_id, so it
    // can't serve those lookups.
    index("team_user_idx").on(t.userId),
  ]
)

export const workspaceInvites = pgTable(
  "workspace_invites",
  {
    id: id(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    // Normalised on write; the case-insensitive index below is what lookups
    // and the signup backfill match on.
    email: text("email").notNull(),
    // Must be a workspace-scope role. `roles` holds two scopes with duplicate
    // titles, so this FK alone does not prove it — the service validates.
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "restrict" }),
    // SHA-256 of the emailed token, never the token itself. Named for what it
    // is so nobody logs or compares it in the clear.
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    // Audit trail. Deliberately not surfaced in the workspace switcher — see
    // the reconnaissance note in the handoff — and only ever sent to admins.
    invitedBy: text("invited_by").references(() => user.id, {
      onDelete: "set null",
    }),
    acceptedAt: timestamp("accepted_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("workspace_invites_workspace_idx").on(t.workspaceId),
    index("workspace_invites_email_idx").on(sql`lower(${t.email})`),
    // One live invite per address per workspace. Without this, an admin can
    // mint unlimited live tokens for one person. It also makes resend a plain
    // replace: delete the pending row, insert a fresh one.
    uniqueIndex("workspace_invites_pending_unique")
      .on(t.workspaceId, sql`lower(${t.email})`)
      .where(sql`${t.acceptedAt} IS NULL`),
  ]
)

export type Workspace = typeof workspaces.$inferSelect
export type Role = typeof roles.$inferSelect
export type TeamMembership = typeof team.$inferSelect
export type WorkspaceInvite = typeof workspaceInvites.$inferSelect
