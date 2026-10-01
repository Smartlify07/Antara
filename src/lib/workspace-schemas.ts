import { z } from "zod"

export const workspaceSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "Handle must be at least 2 characters")
  .max(60, "Handle must be at most 60 characters")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers, and single hyphens"
  )

export const workspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Workspace name must be at least 2 characters")
    .max(100, "Workspace name must be at most 100 characters"),
  slug: workspaceSlugSchema,
  avatarUrl: z.url("Avatar URL is invalid").nullable().optional(),
})

export type WorkspaceInput = z.infer<typeof workspaceSchema>

/** Derives a URL-safe handle from a workspace name. */
export function slugifyName(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}
