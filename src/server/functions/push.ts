import { createServerFn } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"
import { redirect } from "@tanstack/react-router"
import { auth } from "@/lib/auth"
import {
  pushSubscriptionSchema,
  pushUnsubscribeSchema,
} from "@/lib/push-schemas"
import {
  removeSubscription,
  saveSubscription,
} from "@/server/services/push-service"

/**
 * Thin HTTP boundary for the browser-push lane. Session handling and input
 * validation live here; storage delegates to the service. A subscription is
 * account-scoped — the opt-in toggle is per browser, but the row belongs to
 * the signed-in user, so the boundary resolves the session and never takes a
 * user id from the caller.
 */

async function requireUserId(): Promise<string> {
  const session = await auth.api.getSession({
    headers: await getRequestHeaders(),
  })
  if (!session?.user)
    throw redirect({ to: "/login", search: { callbackURL: undefined } })
  return session.user.id
}

/** Records this browser's subscription for the session user. */
export const savePushSubscriptionFn = createServerFn({ method: "POST" })
  .validator(pushSubscriptionSchema)
  .handler(async ({ data }) => {
    const userId = await requireUserId()
    await saveSubscription(userId, {
      endpoint: data.endpoint,
      keys: data.keys,
    })
    return { ok: true }
  })

/** Drops this browser's subscription when notifications are turned off. */
export const removePushSubscriptionFn = createServerFn({ method: "POST" })
  .validator(pushUnsubscribeSchema)
  .handler(async ({ data }) => {
    const userId = await requireUserId()
    await removeSubscription(userId, data.endpoint)
    return { ok: true }
  })
