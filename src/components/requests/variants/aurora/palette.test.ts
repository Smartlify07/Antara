import { describe, expect, it } from "vitest"
import {
  AURORA_CHIP,
  AURORA_CHIP_NEUTRAL,
  AURORA_URGENT_CHIP_CLASS,
  auroraSeed,
  auroraSky,
  auroraStatusChipClass,
} from "./palette"

/**
 * The aurora ground rules: skies are deterministic per request, they read
 * as night (white text never gambles on contrast), and the chips keep the
 * white-on-gradient promise instead of borrowing light-surface classes.
 */
describe("auroraSeed", () => {
  it("is deterministic for the same request", () => {
    expect(auroraSeed("req_1")).toEqual(auroraSeed("req_1"))
  })

  it("stays in the night-sky gamut", () => {
    for (const id of Array.from({ length: 40 }, (_, i) => `req_${i}x`)) {
      const seed = auroraSeed(id)
      expect(seed.skyHue).toBeGreaterThanOrEqual(208)
      expect(seed.skyHue).toBeLessThanOrEqual(270)
      expect(seed.curtainHue).toBeGreaterThanOrEqual(150)
      expect(seed.curtainHue).toBeLessThanOrEqual(310)
      expect(seed.skyAngle).toBeGreaterThanOrEqual(152)
      expect(seed.skyAngle).toBeLessThanOrEqual(208)
      expect(seed.curtainX).toBeGreaterThanOrEqual(46)
      expect(seed.curtainX).toBeLessThanOrEqual(86)
      expect(seed.curtainY).toBeGreaterThanOrEqual(-4)
      expect(seed.curtainY).toBeLessThanOrEqual(14)
      expect(seed.glowX).toBeGreaterThanOrEqual(8)
      expect(seed.glowX).toBeLessThanOrEqual(42)
      expect(seed.drift).toBeGreaterThanOrEqual(26)
      expect(seed.drift).toBeLessThanOrEqual(60)
    }
  })

  it("drifts apart across requests, so grids never look tiled", () => {
    const seeds = Array.from({ length: 24 }, (_, i) =>
      auroraSeed(`req_seed_${i}`)
    )
    const skyHues = new Set(seeds.map((s) => s.skyHue))
    expect(skyHues.size).toBeGreaterThan(10)
    const curtainSpread =
      Math.max(...seeds.map((s) => s.curtainHue)) -
      Math.min(...seeds.map((s) => s.curtainHue))
    expect(curtainSpread).toBeGreaterThanOrEqual(100)
    const angleSpread =
      Math.max(...seeds.map((s) => s.skyAngle)) -
      Math.min(...seeds.map((s) => s.skyAngle))
    expect(angleSpread).toBeGreaterThanOrEqual(20)
  })
})

describe("auroraSky", () => {
  it("is stable per request", () => {
    expect(auroraSky({ id: "req_1" })).toEqual(auroraSky({ id: "req_1" }))
  })

  it("differs across requests", () => {
    expect(auroraSky({ id: "req_1" }).backgroundImage).not.toBe(
      auroraSky({ id: "req_2" }).backgroundImage
    )
  })

  it("layers the curtain and counter-glow over the linear sky", () => {
    const sky = auroraSky({ id: "req_1" }).backgroundImage ?? ""
    expect(sky).toContain("radial-gradient")
    expect(sky).toContain("linear-gradient")
    // The night sky is the bottom layer, so the glow mixes into it.
    expect(sky.lastIndexOf("linear-gradient")).toBeGreaterThan(
      sky.lastIndexOf("radial-gradient")
    )
  })

  it("reads dark overall: every solid stop stays at 16% lightness or below", () => {
    for (const id of Array.from({ length: 12 }, (_, i) => `req_dark_${i}`)) {
      const sky = auroraSky({ id }).backgroundImage ?? ""
      // Solid stops are the ones with no alpha (the base sky layers).
      const solidLightness = [...sky.matchAll(/hsl\(\d+ \d+% (\d+)%\)/g)].map(
        (m) => Number(m[1])
      )
      expect(solidLightness.length).toBeGreaterThanOrEqual(3)
      for (const lightness of solidLightness) {
        expect(lightness).toBeLessThanOrEqual(16)
      }
    }
  })
})

describe("aurora chips", () => {
  it("status chips stay white-on-dark, tinted only at the ring", () => {
    for (const [status, tint] of [
      ["open", "sky-300/30"],
      ["needs_info", "amber-300/30"],
      ["accepted", "emerald-300/30"],
      ["declined", "white/20"],
    ] as const) {
      const cls = auroraStatusChipClass(status)
      expect(cls).toContain(AURORA_CHIP)
      expect(cls).toContain("text-white/85")
      expect(cls).toContain(`ring-${tint}`)
    }
  })

  it("the category chip is the neutral white ground", () => {
    expect(AURORA_CHIP_NEUTRAL).toContain(AURORA_CHIP)
    expect(AURORA_CHIP_NEUTRAL).toContain("ring-white/15")
  })

  it("the urgent chip glows rose, calmly", () => {
    expect(AURORA_URGENT_CHIP_CLASS).toContain("bg-rose-400/20")
    expect(AURORA_URGENT_CHIP_CLASS).toContain("text-rose-100")
    expect(AURORA_URGENT_CHIP_CLASS).toContain("ring-rose-200/40")
    expect(AURORA_URGENT_CHIP_CLASS).toContain("shadow-")
  })
})
