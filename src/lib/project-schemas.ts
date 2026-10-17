import { z } from "zod"

export const projectSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "Handle must be at least 2 characters")
  .max(60, "Handle must be at most 60 characters")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers, and single hyphens"
  )

export const createProjectSchema = z
  .object({
    workspaceId: z.string(),
    title: z
      .string()
      .trim()
      .min(2, "Project title must be at least 2 characters")
      .max(120, "Project title must be at most 120 characters"),
    description: z
      .string()
      .trim()
      .max(2000, "Description must be at most 2000 characters")
      .optional()
      .or(z.literal("")),
    status: z
      .enum(["planning", "active", "on_hold", "completed", "archived"])
      .default("planning"),
    startDate: z.date().nullable().optional(),
    deadline: z.date().nullable().optional(),
    /** Workspace member ids to add as plain members. */
    memberIds: z.array(z.string()).max(50).default([]),
    /** Single workspace member id assigned the project `lead` role. */
    leadId: z.string().nullable().optional(),
    /** Existing tag ids, plus labels to create when missing. */
    tagIds: z.array(z.string()).default([]),
    newTagLabels: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  })
  .refine(
    (data) =>
      !data.startDate || !data.deadline || data.deadline >= data.startDate,
    {
      message: "End date must be on or after the start date",
      path: ["deadline"],
    }
  )

export type CreateProjectInput = z.infer<typeof createProjectSchema>

export const createTagSchema = z.object({
  workspaceId: z.string(),
  label: z.string().trim().min(1).max(40),
})

const projectStatusEnum = z.enum([
  "planning",
  "active",
  "on_hold",
  "completed",
  "archived",
])

const scopedProject = z.object({
  workspaceId: z.string(),
  projectId: z.string(),
})

export const setProjectTitleSchema = z.object({
  ...scopedProject.shape,
  title: z
    .string()
    .trim()
    .min(2, "Project title must be at least 2 characters")
    .max(120, "Project title must be at most 120 characters"),
})

/** Body text for the feed composer. */
export const projectUpdateSchema = z.object({
  ...scopedProject.shape,
  body: z
    .string()
    .trim()
    .min(1, "Write something before sending")
    .max(4000, "Update must be at most 4000 characters"),
  /**
   * Whether this is a running comment or a progress update. Both live in one
   * table and share one review flow, so this only changes how the feed labels
   * the post. Defaults to a comment, which is what an unqualified post is.
   */
  kind: z.enum(["comment", "progress_update"]).default("comment"),
  /**
   * Already-uploaded files. The browser uploads each attachment to the
   * provider first, then posts the resulting metadata here — so the
   * request carries URLs, never bytes.
   */
  attachments: z
    .array(
      z.object({
        filename: z.string().trim().min(1).max(255),
        url: z.string().url(),
        provider: z.enum(["cloudinary", "aws"]),
        providerKey: z.string().trim().min(1).max(512),
        mimeType: z.string().trim().min(1).max(255),
        sizeBytes: z.number().int().nonnegative(),
      })
    )
    .max(20)
    .default([]),
})

export const setProjectLeadSchema = z.object({
  ...scopedProject.shape,
  /** `team.id` of the new lead, or null to clear the role. */
  teamId: z.string().nullable(),
})

export const addProjectMembersSchema = z.object({
  ...scopedProject.shape,
  teamIds: z.array(z.string()).max(50),
})

export const setProjectDatesSchema = z
  .object({
    ...scopedProject.shape,
    startDate: z.date().nullable(),
    deadline: z.date().nullable(),
  })
  .refine(
    (data) =>
      !data.startDate || !data.deadline || data.deadline >= data.startDate,
    {
      message: "End date must be on or after the start date",
      path: ["deadline"],
    }
  )

export const setProjectTagsSchema = z.object({
  ...scopedProject.shape,
  tagIds: z.array(z.string()).max(20).default([]),
  newTagLabels: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
})

export const setProjectDescriptionSchema = z.object({
  ...scopedProject.shape,
  description: z.string().trim().max(2000).or(z.literal("")),
})

export { projectStatusEnum }

/** Derives a URL-safe handle from a project title. */
export function slugifyTitle(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}
