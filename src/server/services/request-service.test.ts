import { describe, expect, it } from "vitest"
import { canPostOnRequest, canTriage } from "./request-permissions"
import { assertRequestTriageTransition } from "./workflow-states"

/**
 * Request triage permission matrix (the plan's rule: admin or lead only) plus
 * the transitions the triage actions press. The predicates are pure by
 * design — see request-permissions.ts — so these run without a database,
 * which is exactly where a permissions change should be caught.
 */
describe("request triage permissions", () => {
  it("the workspace owner can triage", () => {
    expect(canTriage({ role: "member", isOwner: true })).toBe(true)
  })

  it("workspace admins and leads can triage", () => {
    expect(canTriage({ role: "admin", isOwner: false })).toBe(true)
    expect(canTriage({ role: "lead", isOwner: false })).toBe(true)
  })

  it("plain members and unnamed custom roles cannot triage", () => {
    expect(canTriage({ role: "member", isOwner: false })).toBe(false)
    expect(canTriage({ role: "observer", isOwner: false })).toBe(false)
  })

  it("every member may speak on a request's brief thread", () => {
    expect(canPostOnRequest({ role: "member", isOwner: false })).toBe(true)
    expect(canPostOnRequest(null)).toBe(false)
  })
})

describe("triage transitions the actions press", () => {
  // The needs-info round trip: team asks, requester answers, lead resolves.
  it("open walks to needs_info and back without losing eligibility", () => {
    expect(() =>
      assertRequestTriageTransition("open", "needs_info")
    ).not.toThrow()
    expect(() =>
      assertRequestTriageTransition("needs_info", "open")
    ).not.toThrow()
  })

  it("accepting and declining are both reachable from open and needs_info", () => {
    for (const from of ["open", "needs_info"] as const) {
      expect(() =>
        assertRequestTriageTransition(from, "accepted")
      ).not.toThrow()
      expect(() =>
        assertRequestTriageTransition(from, "declined")
      ).not.toThrow()
    }
  })

  it("no decision is reversible", () => {
    expect(() =>
      assertRequestTriageTransition("accepted", "declined")
    ).toThrow()
    expect(() => assertRequestTriageTransition("declined", "open")).toThrow()
  })

  it("no triage action can leave the status where it found it", () => {
    expect(() => assertRequestTriageTransition("open", "open")).toThrow()
  })
})
