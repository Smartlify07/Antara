import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { requestTriageStatus, taskPriority } from "../enums"
import { user } from "./auth"
import { projects } from "./projects"
import { id } from "./shared"
import { workspaces } from "./workspaces"

export const requests = pgTable(
  "requests",
  {
    id: id(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    // Nullable so deleting the requester's account never destroys the request
    // or its triage history — it becomes an unattributed record instead.
    requesterId: text("requester_id").references(() => user.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    // The brief. NotNull: a request without a brief is a title, and triage
    // cannot start from a title.
    brief: text("brief").notNull(),
    // Free text for now. The creative categories launch-first question is an
    // open one in the PRD (§17); a column of text survives any answer.
    category: text("category"),
    // Nullable — the PRD asks for priority "if applicable", so absence is a
    // value, not a default. Reuses the task vocabulary: the same people set
    // both, and the words mean the same thing.
    priority: taskPriority("priority"),
    desiredDeadline: timestamp("desired_deadline"),
    triageStatus: requestTriageStatus("triage_status")
      .notNull()
      .default("open"),
    // Set at accept time. Set-null so declining/detaching never rewrites the
    // request's own history.
    projectId: text("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    // Links the requester pointed at (briefs, moodboards, competitor pages).
    // Plain URLs — nothing is hosted here.
    referenceLinks: text("reference_links").array(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    // The triage inbox reads: all requests in this workspace, grouped by state.
    index("requests_workspace_triage_idx").on(t.workspaceId, t.triageStatus),
    // "Requests I submitted" on the Home dashboard.
    index("requests_requester_idx").on(t.requesterId),
  ]
)

export type Request = typeof requests.$inferSelect
