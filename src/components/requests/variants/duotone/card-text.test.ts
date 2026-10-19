import { describe, expect, it } from "vitest"
import {
  BRIEF_TITLE_BUDGET,
  hasBriefRoom,
  messagesLabel,
  requesterInitial,
} from "./card-text"

describe("hasBriefRoom", () => {
  it("lets a short title carry the brief excerpt", () => {
    expect(hasBriefRoom("Fix the login loop")).toBe(true)
  })

  it("holds the whole budget", () => {
    expect("x".repeat(BRIEF_TITLE_BUDGET).length).toBe(48)
    expect(hasBriefRoom("x".repeat(48))).toBe(true)
    expect(hasBriefRoom("x".repeat(49))).toBe(false)
  })
})

describe("requesterInitial", () => {
  it("takes the first name's first letter", () => {
    expect(requesterInitial("Anastasia Kovalenko")).toBe("A")
    expect(requesterInitial("  iris ")).toBe("I")
  })

  it("never crashes on a blank name", () => {
    expect(requesterInitial(null)).toBe("?")
    expect(requesterInitial("   ")).toBe("?")
    expect(requesterInitial("")).toBe("?")
  })
})

describe("messagesLabel", () => {
  it("pluralizes except for one", () => {
    expect(messagesLabel(1)).toBe("1 message")
    expect(messagesLabel(4)).toBe("4 messages")
  })
})
