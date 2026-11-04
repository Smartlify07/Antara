import { z } from "zod"

/**
 * Validation for the notification lane (FR-047..050). The Inbox page and its
 * sidebar badge live inside a workspace and only ever know the slug they were
 * rendered under — the same contract as the Requests badge
 * (`request-schemas`), so every surface here names its workspace by slug and
 * the boundary resolves it once.
 */

/** The unread badge: one number for this workspace and session user. */
export const notificationListSchema = z.object({
  workspaceSlug: z.string().min(1),
})

export type NotificationListInput = z.infer<typeof notificationListSchema>

/**
 * One page of the inbox. The cursor is opaque to the caller — it is the
 * server's own `(createdAt, id)` key, passed back verbatim to read the next
 * page. An absent cursor means the newest page.
 */
export const notificationInboxSchema = z.object({
  workspaceSlug: z.string().min(1),
  cursor: z.string().trim().min(1).optional(),
})

export type NotificationInboxInput = z.infer<typeof notificationInboxSchema>

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
