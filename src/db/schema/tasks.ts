import {
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core"
import { taskPriority, taskStatus } from "../enums"
import { user } from "./auth"
import { projectMembers, projects } from "./projects"
import { id } from "./shared"

export const tasks = pgTable(
  "tasks",
  {
    id: id(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    status: taskStatus("status").notNull().default("backlog"),
    priority: taskPriority("priority").notNull().default("medium"),
    dueDate: timestamp("due_date"),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("tasks_project_status_idx").on(t.projectId, t.status),
    index("tasks_project_idx").on(t.projectId),
  ]
)

// Assignments point at the membership, not the user: this enforces
// "assignees must be project members" at the DB level and lets
// assignments survive leave/suspend/rejoin untouched.
export const taskAssignees = pgTable(
  "task_assignees",
  {
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    projectMemberId: text("project_member_id")
      .notNull()
      .references(() => projectMembers.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.projectMemberId] })]
)

// Audit trail of status transitions (who approved what, when).
export const statusHistory = pgTable(
  "status_history",
  {
    id: id(),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    fromStatus: taskStatus("from_status"),
    toStatus: taskStatus("to_status").notNull(),
    changedBy: text("changed_by").references(() => user.id, {
      onDelete: "set null",
    }),
    changedAt: timestamp("changed_at").notNull().defaultNow(),
  },
  (t) => [index("status_history_task_idx").on(t.taskId, t.changedAt)]
)

export const comments = pgTable(
  "comments",
  {
    id: id(),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("comments_task_idx").on(t.taskId, t.createdAt)]
)

export type Task = typeof tasks.$inferSelect
export type StatusHistoryEntry = typeof statusHistory.$inferSelect
export type Comment = typeof comments.$inferSelect
