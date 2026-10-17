import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { approvalDecision } from "../enums"
import { assetVersions } from "./assets"
import { user } from "./auth"
import { id } from "./shared"
import { workspaces } from "./workspaces"

/**
 * An explicit decision recorded against a specific version (PRD §9.1).
 *
 * Append-only, with no unique constraint on version: a version may in fact be
 * re-decided (a reviewer asks for changes, the team discusses, the same
 * version is approved). Each decision is a row; the LATEST row for a version
 * is the live decision, which is also what mirrors into
 * `asset_versions.review_status`. The transaction that writes a decision
 * updates both — the row keeps the history, the version column keeps the
 * answer cheap.
 */
export const approvals = pgTable(
  "approvals",
  {
    id: id(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    // The exact version this decision is about (PRD FR-032). RESTRICT: an
    // approval is a historical record about work that happened — it must never
    // silently disappear because a version row went away.
    assetVersionId: text("asset_version_id")
      .notNull()
      .references(() => assetVersions.id, { onDelete: "restrict" }),
    // Approver authorization is enforced by the service, not by a FK — who may
    // approve is a workflow rule (plan's permission table), not a data one.
    // Set-null matches the codebase's actor convention: the record stays even
    // if the account goes, preserving "who approved, when" as long as they
    // exist — and the decision's existence afterwards.
    approverId: text("approver_id").references(() => user.id, {
      onDelete: "set null",
    }),
    decision: approvalDecision("decision").notNull(),
    // Optional comment with the decision (PRD FR-035).
    comment: text("comment"),
    decidedAt: timestamp("decided_at").notNull().defaultNow(),
  },
  (t) => [
    // "Which decision lives on this version" — the version history page reads
    // this in order.
    index("approvals_version_idx").on(t.assetVersionId, t.decidedAt),
    index("approvals_workspace_idx").on(t.workspaceId),
  ]
)

export type Approval = typeof approvals.$inferSelect
