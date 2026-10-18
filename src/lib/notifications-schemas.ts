import { z } from "zod"

/**
 * Validation for the notification lane (FR-047..050). The bell lives in the
 * workspace shell and only ever knows the slug it was rendered under — the
 * same contract as the Requests badge (`request-schemas`), so every surface
 * here names its workspace by slug and the boundary resolves it once.
 */

/** The inbox list: latest rows in this workspace for the session user. */
export const notificationListSchema = z.object({
  workspaceSlug: z.string().min(1),
})

export type NotificationListInput = z.infer<typeof notificationListSchema>

/** Marking one row read (row tap, or the hover action). */
export const notificationReadSchema = z.object({
  workspaceSlug: z.string().min(1),
  notificationId: z.string().min(1),
})

export type NotificationReadInput = z.infer<typeof notificationReadSchema>

/** Clearing the whole workspace's unread count. */
export const notificationReadAllSchema = z.object({
  workspaceSlug: z.string().min(1),
})
