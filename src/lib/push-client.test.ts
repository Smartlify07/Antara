import { describe, expect, it } from "vitest"
import { serializeSubscription } from "./push-client"

/**
 * The serializer is the boundary between a browser object and a stored row:
 * a partial subscription must be rejected here, not written and then failed
 * on by every future send.
 */

function fake(toJSON: unknown) {
  return { toJSON: () => toJSON } as Pick<PushSubscription, "toJSON">
}

describe("serializeSubscription", () => {
  it("narrows a complete subscription to endpoint plus keys", () => {
    expect(
      serializeSubscription(
        fake({
          endpoint: "https://fcm.googleapis.com/fcm/send/abc",
          keys: { p256dh: "key", auth: "secret" },
        })
      )
    ).toEqual({
      endpoint: "https://fcm.googleapis.com/fcm/send/abc",
      keys: { p256dh: "key", auth: "secret" },
    })
  })

  it("rejects a subscription with no endpoint", () => {
    expect(
      serializeSubscription(fake({ keys: { p256dh: "key", auth: "secret" } }))
    ).toBeNull()
  })

  it("rejects a subscription missing an encryption key", () => {
    expect(
      serializeSubscription(
        fake({ endpoint: "https://example.com/x", keys: { p256dh: "key" } })
      )
    ).toBeNull()
  })

  it("rejects a serializer that returns nothing", () => {
    expect(serializeSubscription(fake(undefined))).toBeNull()
  })
})
