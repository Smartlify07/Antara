import { z } from "zod"

/**
 * Validation for deliverables (FR-013..015, 017). Server functions use these
 * as their validators; forms reuse the same shapes so the client and the wire
 * agree by construction. Task validation lives in `task-schemas.ts`.
 */

export const deliverableStatusSchema = z.enum([
  "planned",
  "in_progress",
  "blocked",
  "ready_for_review",
  "changes_requested",
  "completed",
])

export type DeliverableStatusValue = z.infer<typeof deliverableStatusSchema>

export const projectIdSchema = z.object({
  workspaceId: z.string().min(1),
  projectId: z.string().min(1),
})

/** Date-only string the form produces; the service turns it into a UTC day. */
const deadlineDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a calendar date.")

export const createDeliverableSchema = z.object({
  workspaceId: z.string().min(1),
  projectId: z.string().min(1),
  // A deliverable without a name is not findable on the card grid.
  title: z.string().trim().min(1, "Name the deliverable.").max(200),
  description: z.string().trim().max(4000).optional(),
  // Free text while the PRD's category question (§17) is open.
  type: z.string().trim().max(80).optional(),
  // Owner is a workspace membership (`team`), not a bare user — the schema
  // comment on `deliverables.owner_id` explains why. Optional at creation.
  ownerId: z.string().trim().max(64).optional(),
  deadline: deadlineDate.optional(),
})

export type CreateDeliverableInput = z.infer<typeof createDeliverableSchema>

export const deliverableIdSchema = z.object({
  workspaceId: z.string().min(1),
  projectId: z.string().min(1),
  deliverableId: z.string().min(1),
})

/** Reassign the deliverable; `ownerId: null` explicitly unassigns. */
export const setDeliverableOwnerSchema = deliverableIdSchema.extend({
  ownerId: z.string().trim().max(64).nullable(),
})

export type SetDeliverableOwnerInput = z.infer<typeof setDeliverableOwnerSchema>

export const setDeliverableDeadlineSchema = deliverableIdSchema.extend({
  deadline: deadlineDate.nullable(),
})

export type SetDeliverableDeadlineInput = z.infer<
  typeof setDeliverableDeadlineSchema
>

/**
 * A production-status move. The transition legality itself is the workflow
 * machine's job (`workflow-states.ts`); the schema only carries intent.
 */
export const setDeliverableStatusSchema = deliverableIdSchema.extend({
  status: deliverableStatusSchema,
})
