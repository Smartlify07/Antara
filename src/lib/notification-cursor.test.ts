import { describe, expect, it } from "vitest"
import {
  encodeNotificationCursor,
  parseNotificationCursor,
} from "./notification-cursor"

describe("notification cursor", () => {
  it("round-trips the ordering pair", () => {
    const createdAt = new Date("2026-10-01T09:30:00.000Z")
    const raw = encodeNotificationCursor(
      createdAt,
      "0b8f3ad0-1c4e-4d9a-9a6f-2f1d5e7c9a11"
    )

    expect(parseNotificationCursor(raw)).toEqual({
      createdAt,
      id: "0b8f3ad0-1c4e-4d9a-9a6f-2f1d5e7c9a11",
    })
  })

  it("treats a missing cursor as the first page", () => {
    expect(parseNotificationCursor(undefined)).toBeNull()
    expect(parseNotificationCursor(null)).toBeNull()
    expect(parseNotificationCursor("")).toBeNull()
  })

  it("falls open on malformed cursors rather than throwing", () => {
    expect(parseNotificationCursor("not-a-cursor")).toBeNull()
    expect(parseNotificationCursor("|id")).toBeNull()
    expect(parseNotificationCursor("2026-10-01T09:30:00.000Z|")).toBeNull()
    expect(parseNotificationCursor("garbage|id")).toBeNull()
  })
})
