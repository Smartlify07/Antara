import { z } from "zod"
import { createProjectSchema } from "@/lib/project-schemas"

/**
 * Validation for the Requests module (FR-006..011). Server functions use
 * these as their validators; forms reuse the same shapes so the client and
 * the wire agree by construction.
 */

export const requestPrioritySchema = z.enum(["low", "medium", "high", "urgent"])

/** States of the triage queue; mirrors `requestTriageStatus` in the DB. */
export const requestTriageStatusSchema = z.enum([
  "open",
  "needs_info",
  "accepted",
  "declined",
])

export type RequestTriageStatusValue = z.infer<typeof requestTriageStatusSchema>

/**
 * Client-side mirror of the server's triage predicate
 * (`request-permissions.ts`). The server always re-derives authority
 * itself; this exists so route components don't fork the role matrix —
 * roles' titles are seeded `admin` / `lead`, and ownership is admin by fact.
 */
export function workspaceRoleCanTriage(
  role: string,
  isOwner: boolean
): boolean {
  return isOwner || role === "admin" || role === "lead"
}

export const submitRequestSchema = z.object({
  workspaceId: z.string().min(1),
  // Titles survive on cards and badges; a string of spaces is not a title.
  title: z.string().trim().min(1, "Give the request a title.").max(200),
  // The brief itself. Triage cannot start from a title (schema comment on
  // `requests.brief`), so the floor is intentionally higher than 1.
  brief: z
    .string()
    .trim()
    .min(20, "Describe the work — at least a sentence or two.")
    .max(20000),
  // Free text while the PRD's category question (§17) is open.
  category: z.string().trim().max(80).optional(),
  priority: requestPrioritySchema.optional(),
  // "Desired", not "required": an empty picker means the requester has none.
  desiredDeadline: z
    .string()
    .trim()
    .max(32)
    .optional()
    .transform((value) => (value ? value : undefined)),
  // Links the requester points at. Lenient on purpose — briefs come from
  // everywhere — but bounded: a wall of links is a brief, and a 2KB link is
  // a smuggled payload.
  referenceLinks: z
    .array(z.string().trim().max(2048))
    .nonempty()
    .max(10)
    .transform((links) => links.filter((link) => link.length > 0))
    .optional(),
})

export type SubmitRequestInput = z.infer<typeof submitRequestSchema>

export const requestIdSchema = z.object({
  workspaceId: z.string().min(1),
  requestId: z.string().min(1),
})

/**
 * Accept-time asks for exactly one destination: an existing project in this
 * workspace, or a title to mint a new one. Both filled is a form bug; neither
 * is a no-op acceptance, which invites a "what did that button do" support
 * ticket.
 *
 * Minting a project can also carry the rest of the create-form's shape
 * (status, dates, people, tags). Those fields reuse `createProjectSchema`'s
 * field schemas verbatim so the accept dialog and the create form cannot
 * drift apart on limits — and the ones carrying defaults are optional on the
 * wire: older clients that send only a title still validate.
 */
export const acceptRequestSchema = z
  .object({
    workspaceId: z.string().min(1),
    requestId: z.string().min(1),
    projectId: z.string().min(1).optional(),
    newProjectTitle: z
      .string()
      .trim()
      .min(1, "Name the project.")
      .max(120)
      .optional(),
    newProjectDescription: z.string().trim().max(2000).optional(),
    newProjectStatus: createProjectSchema.shape.status,
    newProjectStartDate: createProjectSchema.shape.startDate,
    newProjectDeadline: createProjectSchema.shape.deadline,
    newProjectMemberIds: createProjectSchema.shape.memberIds,
    newProjectLeadId: createProjectSchema.shape.leadId,
    newProjectTagIds: createProjectSchema.shape.tagIds,
    newProjectTagLabels: createProjectSchema.shape.newTagLabels,
    // Optional decision note; becomes the thread's audit entry.
    note: z.string().trim().max(2000).optional(),
  })
  .refine((v) => Boolean(v.projectId) !== Boolean(v.newProjectTitle), {
    message: "Pick an existing project or name a new one — not both.",
  })
  .refine(
    (v) =>
      !v.newProjectStartDate ||
      !v.newProjectDeadline ||
      v.newProjectDeadline >= v.newProjectStartDate,
    {
      message: "End date must be on or after the start date",
      path: ["newProjectDeadline"],
    }
  )

export type AcceptRequestInput = z.input<typeof acceptRequestSchema>

/** A message on the brief thread, whether posted freely or at needs-info. */
export const requestMessageSchema = z.object({
  workspaceId: z.string().min(1),
  requestId: z.string().min(1),
  body: z.string().trim().min(1, "Write something.").max(4000),
})

export type RequestMessageInput = z.infer<typeof requestMessageSchema>
