import { describe, expect, it } from "vitest"
import {
  GRADIENT_RECIPE_COUNT,
  coverGradientStyle,
  gradientRecipeIndex,
  hashString,
} from "./gradient-recipes"

/**
 * Covers must be deterministic (same request → same cover) and drawn from
 * the curated palette — the generated hue wheels were the first pass and
 * they aesthetically lost.
 */
describe("hashString", () => {
  it("is deterministic", () => {
    expect(hashString("req-1")).toBe(hashString("req-1"))
  })
})

describe("gradientRecipeIndex", () => {
  it("stays inside the curated palette", () => {
    for (let i = 0; i < 500; i++) {
      const idx = gradientRecipeIndex(`seed-${i}`)
      expect(idx).toBeGreaterThanOrEqual(0)
      expect(idx).toBeLessThan(GRADIENT_RECIPE_COUNT)
    }
  })

  it("uses more than one cover across a growing inbox", () => {
    const covers = new Set(
      Array.from({ length: 40 }, (_, i) => gradientRecipeIndex(`req-${i}`))
    )
    expect(covers.size).toBeGreaterThanOrEqual(3)
  })
})

describe("coverGradientStyle", () => {
  it("is stable per seed", () => {
    expect(coverGradientStyle("req-1")).toEqual(coverGradientStyle("req-1"))
  })

  it("layers a bloom over a diagonal", () => {
    const style = coverGradientStyle("req-1")
    expect(style.backgroundImage).toContain("radial-gradient")
    expect(style.backgroundImage).toContain("linear-gradient")
  })
})
