import { z } from "zod"

/**
 * Validation for the browser push lane. The shape mirrors
 * `PushSubscription.toJSON()` — the client sends the endpoint plus the two
 * encryption keys, and the server stores exactly what web-push needs to sign a
 * payload later. Nothing here is secret on the wire (the keys are the client's
 * own public encryption material), but the shape is validated server-side so a
 * malformed row can never be stored and replayed into `sendNotification`.
 */

export const pushSubscriptionSchema = z.object({
  endpoint: z.url("Push subscription endpoint is invalid"),
  keys: z.object({
    p256dh: z.string().min(1, "p256dh key is required"),
    auth: z.string().min(1, "auth key is required"),
  }),
})

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>

/** Unsubscribing only needs the endpoint, which uniquely identifies a row. */
export const pushUnsubscribeSchema = z.object({
  endpoint: z.string().min(1),
})
