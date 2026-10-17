import { describe, expect, it } from "vitest"
import {
  assertDeliverableTransition,
  assertRequestTriageTransition,
  assertVersionDecidable,
  assertVersionReviewTransition,
  isRequestTerminal,
  supersededStatusFor,
} from "./workflow-states"
import type {
  DeliverableStatus,
  VersionReviewStatus,
} from "@/db/enums"

/**
 * Tests for the PRD's state machines. These guards are the last line of
 * defense against a workflow record reaching a state its UI never meant —
 * and the transitions here are the contract the later increments' services
 * wire their UPDATE ... WHERE clauses against.
 */

describe("request triage transitions", () => {
  it("lets an open request be parked, accepted, or declined", () => {
    expect(() =>
      assertRequestTriageTransition("open", "needs_info")
    ).not.toThrow()
    expect(() =>
      assertRequestTriageTransition("open", "accepted")
    ).not.toThrow()
    expect(() =>
      assertRequestTriageTransition("open", "declined")
    ).not.toThrow()
  })

  it("lets a needs_info request return to open once corrected", () => {
    expect(() =>
      assertRequestTriageTransition("needs_info", "open")
    ).not.toThrow()
  })

  it("marks accepted and declined as terminal", () => {
    expect(isRequestTerminal("accepted")).toBe(true)
    expect(isRequestTerminal("declined")).toBe(true)
    expect(isRequestTerminal("open")).toBe(false)
    expect(isRequestTerminal("needs_info")).toBe(false)
  })

  it("refuses to reopen a terminal request", () => {
    expect(() => assertRequestTriageTransition("declined", "open")).toThrow()
    expect(() =>
      assertRequestTriageTransition("accepted", "needs_info")
    ).toThrow()
  })

  it("refuses no-op writes", () => {
    expect(() => assertRequestTriageTransition("open", "open")).toThrow()
  })
})

describe("deliverable production transitions", () => {
  const cases: Array<[DeliverableStatus, DeliverableStatus, boolean]> = [
    ["planned", "in_progress", true],
    ["planned", "blocked", true],
    ["in_progress", "ready_for_review", true],
    ["in_progress", "blocked", true],
    ["in_progress", "planned", true], // re-scope back
    ["blocked", "in_progress", true],
    ["ready_for_review", "changes_requested", true],
    ["changes_requested", "in_progress", true],
    ["changes_requested", "completed", true],
    ["completed", "in_progress", false], // completed is terminal
    ["planned", "ready_for_review", false], // must actually start first
    ["blocked", "ready_for_review", false], // unblock before review
  ]
  for (const [from, to, ok] of cases) {
    it(`${from} → ${to} is ${ok ? "allowed" : "refused"}`, () => {
      const attempt = () => assertDeliverableTransition(from, to)
      if (ok) expect(attempt).not.toThrow()
      else expect(attempt).toThrow()
    })
  }
})

describe("version review transitions", () => {
  const legal: Array<[VersionReviewStatus, VersionReviewStatus]> = [
    ["submitted", "approved"],
    ["submitted", "rejected"],
    ["submitted", "changes_requested"],
    ["changes_requested", "approved"], // re-review after edits... without a new version
    ["rejected", "approved"], // overturned on appeal
    ["approved", "superseded"],
    ["submitted", "superseded"],
  ]
  for (const [from, to] of legal) {
    it(`${from} → ${to} is allowed`, () => {
      expect(() => assertVersionReviewTransition(from, to)).not.toThrow()
    })
  }

  const illegal: Array<[VersionReviewStatus, VersionReviewStatus]> = [
    ["superseded", "submitted"], // terminal, machine-assigned only
    ["superseded", "approved"],
    ["approved", "changes_requested"], // an approval is not rewritten; new version instead
    ["approved", "rejected"],
    ["rejected", "changes_requested"],
    ["changes_requested", "submitted"],
  ]
  for (const [from, to] of illegal) {
    it(`${from} → ${to} is refused`, () => {
      expect(() => assertVersionReviewTransition(from, to)).toThrow()
    })
  }
})

describe("supersede rules", () => {
  it("flips every previously-submitted version to superseded", () => {
    expect(supersededStatusFor("submitted")).toBe("superseded")
    expect(supersededStatusFor("approved")).toBe("superseded")
    expect(supersededStatusFor("rejected")).toBe("superseded")
    expect(supersededStatusFor("changes_requested")).toBe("superseded")
  })

  it("leaves a never-submitted draft alone", () => {
    expect(supersededStatusFor(null)).toBeNull()
  })
})

describe("decidability guard", () => {
  it("accepts decisions on live versions, including undecided drafts", () => {
    expect(() => assertVersionDecidable("submitted")).not.toThrow()
    expect(() => assertVersionDecidable(null)).not.toThrow()
    expect(() => assertVersionDecidable("changes_requested")).not.toThrow()
  })

  it("refuses decisions on superseded versions", () => {
    expect(() => assertVersionDecidable("superseded")).toThrow(/superseded/)
  })
})
