/**
 * The browser-side half of a push subscription, kept out of the hook so the
 * shape conversion is testable without a DOM.
 *
 * `PushSubscription.toJSON()` is typed loosely: `endpoint` and `keys` are
 * optional in the spec's serializer, and a browser that returns a partial
 * object must not be sent to the server (the row would be useless and every
 * later send would fail on it). This narrows once, in one place.
 */

export interface SerializedPushSubscription {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export function serializeSubscription(
  subscription: Pick<PushSubscription, "toJSON">
): SerializedPushSubscription | null {
  // `toJSON` is typed as always returning an object; browsers are not that
  // reliable, so the cast keeps a missing result a rejection instead of a
  // TypeError on the settings page.
  const json = subscription.toJSON() as
    | Partial<PushSubscriptionJSON>
    | undefined
  const endpoint = json?.endpoint
  const p256dh = json?.keys?.p256dh
  const auth = json?.keys?.auth
  if (!endpoint || !p256dh || !auth) return null
  return { endpoint, keys: { p256dh, auth } }
}
