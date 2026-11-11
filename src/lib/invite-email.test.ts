import { describe, expect, it } from "vitest"
import { inviteEmailMatches } from "./invite-email"

/**
 * The invite token proves delivery, not identity. This is the check that keeps
 * a forwarded link from becoming a workspace key for whoever received it.
 */
describe("invite email binding", () => {
  it("matches the invited address case-insensitively", () => {
    expect(inviteEmailMatches("Ada@Studio.com", "ada@studio.com")).toBe(true)
    expect(inviteEmailMatches("ada@studio.com", " ADA@studio.com ")).toBe(true)
  })

  it("rejects a different address", () => {
    expect(inviteEmailMatches("ada@studio.com", "mallory@evil.test")).toBe(
      false
    )
    expect(inviteEmailMatches("ada@studio.com", "ada+alias@studio.com")).toBe(
      false
    )
  })
})
