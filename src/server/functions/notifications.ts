import { createServerFn } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"
import { redirect } from "@tanstack/react-router"
import { auth } from "@/lib/auth"
import {
  notificationInboxSchema,
  notificationListSchema,
  notificationReadAllSchema,
  notificationReadSchema,
} from "@/lib/notifications-schemas"
import {
  countUnread,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/server/services/notification-service"
import * as workspaceService from "@/server/services/workspace-service"

/**
 * Thin HTTP boundary for the notification lane (FR-047..050). Session
 * handling and workspace resolution live here; the Inbox page and its badge
 * carry only the slug, so the boundary is also the scope check — a slug the
 * session user cannot enter yields an empty inbox, never another workspace's
 * rows.
 */

async function requireUserId(): Promise<string> {
  const session = await auth.api.getSession({
    headers: await getRequestHeaders(),
  })
  if (!session?.user)
    throw redirect({ to: "/login", search: { callbackURL: undefined } })
  return session.user.id
}

export const listNotificationsFn = createServerFn({ method: "GET" })
  .validator(notificationInboxSchema)
  .handler(async ({ data }) => {
    const userId = await requireUserId()
    const access = await workspaceService.getWorkspaceBySlug(
      userId,
      data.workspaceSlug
    )
    if (!access) return { items: [], nextCursor: null }
    return listNotifications(access.workspace.id, userId, data.cursor)
  })

/**
 * The bell's badge. Zero without access — the badge never argues about why.
 */
export const unreadCountFn = createServerFn({ method: "GET" })
  .validator(notificationListSchema)
  .handler(async ({ data }) => {
    const userId = await requireUserId()
    const access = await workspaceService.getWorkspaceBySlug(
      userId,
      data.workspaceSlug
    )
    if (!access) return 0
    return countUnread(access.workspace.id, userId)
  })

export const markNotificationReadFn = createServerFn({ method: "POST" })
  .validator(notificationReadSchema)
  .handler(async ({ data }) => {
    const userId = await requireUserId()
    const access = await workspaceService.getWorkspaceBySlug(
      userId,
      data.workspaceSlug
    )
    if (!access) return { ok: false }
    const marked = await markNotificationRead(
      access.workspace.id,
      userId,
      data.notificationId
    )
    return { ok: marked }
  })

export const markAllNotificationsReadFn = createServerFn({ method: "POST" })
  .validator(notificationReadAllSchema)
  .handler(async ({ data }) => {
    const userId = await requireUserId()
    const access = await workspaceService.getWorkspaceBySlug(
      userId,
      data.workspaceSlug
    )
    if (!access) return { ok: false }
    await markAllNotificationsRead(access.workspace.id, userId)
    return { ok: true }
  })
