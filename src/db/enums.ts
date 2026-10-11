import { pgEnum } from "drizzle-orm/pg-core"

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

export const roleScope = pgEnum("role_scope", ["workspace", "project"])

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

// One review decision per progress update, made by the project lead. Approval
// attaches to the submission rather than to each file, so a post carrying four
// attachments is one decision rather than four.
export const updateReviewStatus = pgEnum("update_review_status", [
  "pending",
  "approved",
  "changes_requested",
])

// A post in the feed is either a running comment on the work or a progress
// update on the project. They share one table and one review flow; the kind
// only changes how the feed labels and orders them.
export const updateKind = pgEnum("update_kind", ["comment", "progress_update"])

export type TaskStatus = (typeof taskStatus.enumValues)[number]
export type TaskPriority = (typeof taskPriority.enumValues)[number]
export type AssetProvider = (typeof assetProvider.enumValues)[number]
export type RoleScope = (typeof roleScope.enumValues)[number]
export type MembershipStatus = (typeof membershipStatus.enumValues)[number]
export type UpdateReviewStatus = (typeof updateReviewStatus.enumValues)[number]
export type UpdateKind = (typeof updateKind.enumValues)[number]
export type DeletionJobStatus = (typeof deletionJobStatus.enumValues)[number]
export type ProjectStatus = (typeof projectStatus.enumValues)[number]
