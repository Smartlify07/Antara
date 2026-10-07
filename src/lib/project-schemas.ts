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
