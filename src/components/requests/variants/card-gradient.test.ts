import { describe, expect, it } from "vitest"
import {
  GRADIENT_SCRIM_CLASS,
  GRADIENT_TEXT,
  hashString,
  requestGradient,
} from "./card-gradient"

/**
 * The pure ground under every request-card variant: the seed hash must be
 * deterministic (same request → same artwork), and the shared tokens must
 * keep the contrast promise the variants rely on.
 */
describe("hashString", () => {
  it("is deterministic for the same input", () => {
    expect(hashString("req_1")).toBe(hashString("req_1"))
  })

  it("spreads different ids apart", () => {
    const ids = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"].map(
      (id) => `req_${id}`
    )
    const hues = new Set(ids.map((id) => hashString(id) % 360))
    expect(hues.size).toBeGreaterThan(1)
  })
})

describe("requestGradient", () => {
  it("is stable per request", () => {
    expect(requestGradient({ id: "req_1" })).toEqual(
      requestGradient({ id: "req_1" })
    )
  })

  it("differs across requests", () => {
    expect(requestGradient({ id: "req_1" }).backgroundImage).not.toBe(
      requestGradient({ id: "req_2" }).backgroundImage
    )
  })

  it("produces a css background", () => {
    expect(
      requestGradient({ id: "req_1" }).backgroundImage
    ).toContain("linear-gradient")
  })
})

describe("white-on-gradient tokens", () => {
  it("title and chips are white, never theme-muted", () => {
    expect(GRADIENT_TEXT.title).toContain("text-white")
    expect(GRADIENT_TEXT.chip).toContain("text-white")
    expect(GRADIENT_TEXT.meta).toContain("text-white")
  })

  it("ships a legibility scrim", () => {
    expect(GRADIENT_SCRIM_CLASS).toContain("bg-gradient-to-t")
  })
})
