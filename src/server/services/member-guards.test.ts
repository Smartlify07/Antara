import { describe, expect, it } from "vitest"
import { checkMemberAction } from "./member-guards"
import type { MemberActionFacts } from "./member-guards"

/**
 * The member-management guard table, pressed without a database.
 *
 * Each guard exists because the alternative is a workspace that can be
 * orphaned, a member who can strand themselves, or a pending invitee whose
 * reserved seat gets treated as a joined member.
 */

function facts(overrides: Partial<MemberActionFacts>): MemberActionFacts {
  return {
    action: "change_role",
    isOwner: false,
    isSelf: false,
    isPending: false,
    currentRole: "member",
    nextRole: "admin",
    remainingManagers: 1,
    ...overrides,
  }
}

describe("checkMemberAction", () => {
  it("allows a plain role change and a removal", () => {
    expect(checkMemberAction(facts({}))).toBeNull()
    expect(checkMemberAction(facts({ action: "remove" }))).toBeNull()
  })

  it("refuses every action against the owner", () => {
    expect(checkMemberAction(facts({ isOwner: true }))?.code).toBe("owner")
    expect(
      checkMemberAction(facts({ isOwner: true, action: "remove" }))?.message
    ).toBe("The workspace owner can't be removed.")
  })

  it("refuses acting on yourself", () => {
    expect(checkMemberAction(facts({ isSelf: true }))?.code).toBe("self")
    expect(
      checkMemberAction(facts({ isSelf: true, action: "remove" }))?.message
    ).toContain("can't remove yourself")
  })

  it("refuses a pending seat, which must be revoked instead", () => {
    expect(checkMemberAction(facts({ isPending: true }))?.code).toBe("pending")
  })

  it("records a no-op role change instead of re-deciding it", () => {
    const rejection = checkMemberAction(
      facts({ currentRole: "admin", nextRole: "admin" })
    )
    expect(rejection?.code).toBe("noop")
    expect(rejection?.message).toBe("They already have the admin role.")
  })

  it("refuses a change that would leave nobody able to manage", () => {
    const rejection = checkMemberAction(facts({ remainingManagers: 0 }))
    expect(rejection?.code).toBe("last_admin")
  })

  it("checks the owner and self before the last-admin count", () => {
    // A guard's message has to name the reason the caller can act on.
    expect(
      checkMemberAction(facts({ isOwner: true, remainingManagers: 0 }))?.code
    ).toBe("owner")
    expect(
      checkMemberAction(facts({ isSelf: true, remainingManagers: 0 }))?.code
    ).toBe("self")
  })
})
