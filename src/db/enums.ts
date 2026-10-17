import { pgEnum } from "drizzle-orm/pg-core"

// Request triage. A stakeholder submits; a lead works it toward rejection or
// acceptance. `needs_info` keeps the request open while the team asks for more.
export const requestTriageStatus = pgEnum("request_triage_status", [
  "open",
  "needs_info",
  "accepted",
  "declined",
])

export const taskStatus = pgEnum("task_status", [
  "backlog",
  "todo",
  "in_progress",
  "done",
  "approved",
])

export const taskPriority = pgEnum("task_priority", [
  "low",
  "medium",
  "high",
  "urgent",
])

export const assetProvider = pgEnum("asset_provider", ["cloudinary", "aws"])

// Deliverable production progress. Deliberately separate from the version
// review lifecycle on `asset_versions.review_status`: a deliverable being "in
// progress" and a version being "awaiting approval" are different dimensions
// of the same work (PRD §8.1 — one ambiguous status field holding both is the
// failure mode this enum exists to prevent).
export const deliverableStatus = pgEnum("deliverable_status", [
  "planned",
  "in_progress",
  "blocked",
  "ready_for_review",
  "changes_requested",
  "completed",
])

// One comment surface for every workflow record with a discussion thread
// (PRD §9.1's generic Comment). Subject identity is (subject_type, subject_id);
// Postgres cannot FK on a polymorphic pair, so valid targets are a service
// concern — each writer must verify the subject exists and is workspace-scoped.
export const commentSubject = pgEnum("comment_subject", [
  "task",
  "request",
  "deliverable",
  "version",
])

export const roleScope = pgEnum("role_scope", ["workspace", "project"])

// How a version's file arrived. `upload` means Antara holds (or indexed) the
// bytes on a provider we know how to delete from; `external_link` means the
// file lives somewhere Antara does not touch — the cleanup worker must never
// act on one (see the enqueue guard in project-update-service).
export const assetVersionSource = pgEnum("asset_version_source", [
  "upload",
  "external_link",
])

// The version review lifecycle (PRD §8.1, simplified per its own note): NULL
// means "never submitted for review". `superseded` is assigned automatically
// when the next version of the same asset arrives — never user-editable.
// There is no `in_review` state: a submitted version that has no decision yet
// IS in review, and a separate state users would have to move through buys
// nothing here.
export const versionReviewStatus = pgEnum("version_review_status", [
  "submitted",
  "approved",
  "rejected",
  "changes_requested",
  "superseded",
])

// The decision recorded against a specific version. `changes_requested` is a
// review outcome, not an approval — it lives on the version's review_status
// plus its feedback comments, so the approvals table only ever holds verdicts.
export const approvalDecision = pgEnum("approval_decision", [
  "approved",
  "rejected",
])

export const membershipStatus = pgEnum("membership_status", [
  "active",
  "suspended",
  "left",
])

export const deletionJobStatus = pgEnum("deletion_job_status", [
  "pending",
  "processing",
  "done",
  "failed",
])

export const projectStatus = pgEnum("project_status", [
  "planning",
  "active",
  "on_hold",
  "completed",
  "archived",
])

// A post in the feed is either a running comment on the work or a progress
// update on the project. The kind only changes how the feed labels and orders
// the post; decisions attach to asset versions (see versionReviewStatus and
// approvals), never to feed posts.
export const updateKind = pgEnum("update_kind", ["comment", "progress_update"])
export type TaskStatus = (typeof taskStatus.enumValues)[number]
export type TaskPriority = (typeof taskPriority.enumValues)[number]
export type AssetProvider = (typeof assetProvider.enumValues)[number]
export type RequestTriageStatus =
  (typeof requestTriageStatus.enumValues)[number]
export type DeliverableStatus = (typeof deliverableStatus.enumValues)[number]
export type CommentSubject = (typeof commentSubject.enumValues)[number]
export type AssetVersionSource = (typeof assetVersionSource.enumValues)[number]
export type VersionReviewStatus =
  (typeof versionReviewStatus.enumValues)[number]
export type ApprovalDecision = (typeof approvalDecision.enumValues)[number]
export type RoleScope = (typeof roleScope.enumValues)[number]
export type MembershipStatus = (typeof membershipStatus.enumValues)[number]
export type UpdateKind = (typeof updateKind.enumValues)[number]
export type DeletionJobStatus = (typeof deletionJobStatus.enumValues)[number]
export type ProjectStatus = (typeof projectStatus.enumValues)[number]
