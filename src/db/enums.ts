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

export type TaskStatus = (typeof taskStatus.enumValues)[number]
export type TaskPriority = (typeof taskPriority.enumValues)[number]
export type AssetProvider = (typeof assetProvider.enumValues)[number]
export type RoleScope = (typeof roleScope.enumValues)[number]
export type MembershipStatus = (typeof membershipStatus.enumValues)[number]
export type UpdateReviewStatus = (typeof updateReviewStatus.enumValues)[number]
export type DeletionJobStatus = (typeof deletionJobStatus.enumValues)[number]
export type ProjectStatus = (typeof projectStatus.enumValues)[number]
