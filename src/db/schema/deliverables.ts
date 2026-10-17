import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { deliverableStatus } from "../enums"
import { user } from "./auth"
import { projects } from "./projects"
import { requests } from "./requests"
import { id } from "./shared"
import { team, workspaces } from "./workspaces"

/**
 * A specific piece of creative work — the PRD's work unit between Project and
 * Task/Version (§9.1). A project holds several deliverables, each with its own
 * owner, deadline and production state, each independently reviewable and
 * approvable (§6.2, FR-017); approving the video never approves the graphics.
 */
export const deliverables = pgTable(
  "deliverables",
  {
    id: id(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    // Where the request came from, when it did. Set-null: unlinking a request
    // from its work must not erase the deliverable.
    requestId: text("request_id").references(() => requests.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    description: text("description"),
    // Free text. Creative categories are an open PRD question (§17); text
    // survives any answer, an enum would have to be migrated.
    type: text("type"),
    // A workspace membership (`team`), not a bare user: assigning work to a
    // non-member would silently orphan it. Set-null so removing the membership
    // unassigns without deleting the deliverable.
    ownerId: text("owner_id").references(() => team.id, {
      onDelete: "set null",
    }),
    productionStatus: deliverableStatus("production_status")
      .notNull()
      .default("planned"),
    deadline: timestamp("deadline"),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    // Project views group deliverables by state; overdue scans filter on deadline.
    index("deliverables_project_status_idx").on(
      t.projectId,
      t.productionStatus
    ),
    // "Work assigned to me" on the Home dashboard.
    index("deliverables_owner_idx").on(t.ownerId),
    // Request → deliverable traceability (§6.1 step 2).
    index("deliverables_request_idx").on(t.requestId),
  ]
)

export type Deliverable = typeof deliverables.$inferSelect
