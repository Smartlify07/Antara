import { z } from "zod"
import { projectIdSchema } from "./deliverable-schemas"

/**
 * Validation for tasks (FR-016) and the "My tasks" surface (FR-052). The
 * assignees-carried-over-the-wire are `team` ids — the UI's member chips are
 * workspace memberships — and the service resolves each one to a
 * `project_members` row, which is the only thing `task_assignees` may
 * reference. Anything that does not resolve is a membership the project has
 * never had, and the call refuses rather than silently dropping it.
 */

export const taskStatusSchema = z.enum([
  "backlog",
  "todo",
  "in_progress",
  "done",
  "approved",
])

export type TaskStatusValue = z.infer<typeof taskStatusSchema>

export const taskPrioritySchema = z.enum(["low", "medium", "high", "urgent"])

export type TaskPriorityValue = z.infer<typeof taskPrioritySchema>

const dueDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a calendar date.")

export const createTaskSchema = projectIdSchema.extend({
  deliverableId: z.string().min(1).nullable().optional(),
  title: z.string().trim().min(1, "Name the task.").max(200),
  description: z.string().trim().max(4000).optional(),
  priority: taskPrioritySchema.optional(),
  dueDate: dueDate.optional(),
  assigneeTeamIds: z.array(z.string().trim().min(1)).max(10).optional(),
})

export type CreateTaskInput = z.infer<typeof createTaskSchema>

export const taskIdSchema = projectIdSchema.extend({
  taskId: z.string().min(1),
})

/** A post on the task's own thread (subjectType "task"). */
export const taskCommentSchema = taskIdSchema.extend({
  // Same bounds as every other lane's comment body — one vocabulary.
  body: z.string().trim().min(1, "Write something first.").max(4000),
})

export type TaskCommentInput = z.infer<typeof taskCommentSchema>

export const setTaskAssigneesSchema = taskIdSchema.extend({
  assigneeTeamIds: z.array(z.string().trim().min(1)).max(10),
})

export type SetTaskAssigneesInput = z.infer<typeof setTaskAssigneesSchema>

/** A status move the viewer pressed; the service adds the history record. */
export const setTaskStatusSchema = taskIdSchema.extend({
  status: taskStatusSchema,
})

export const setTaskDueDateSchema = taskIdSchema.extend({
  dueDate: dueDate.nullable(),
})

/** The route shape for the workspace-scoped "My tasks" page. */
export const myTasksQuerySchema = z.object({
  workspaceId: z.string().min(1),
})
