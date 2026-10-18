import { describe, expect, it } from "vitest"
import {
  SPOTLIGHT_GRAIN,
  isDueEmphasis,
  messageLabel,
  spotlightArtwork,
  spotlightSeed,
} from "./spotlight-art"

/**
 * The spotlight's pure light rig: seeds must be deterministic and spread,
 * the palette must stay out of the rose band (rose = urgency only), the
 * edges must fall to near-black, and texture must stay whisper-alpha.
 */
describe("spotlightSeed", () => {
  it("is deterministic for the same request", () => {
    expect(spotlightSeed("req_1")).toEqual(spotlightSeed("req_1"))
  })

  it("seeds hue into the non-rose band (30–329°)", () => {
    const ids = Array.from({ length: 40 }, (_, i) => `req_${i}`)
    for (const id of ids) {
      const { hue, counterHue } = spotlightSeed(id)
      expect(hue).toBeGreaterThanOrEqual(30)
      expect(hue).toBeLessThanOrEqual(329)
      expect(counterHue).toBeGreaterThanOrEqual(30)
      expect(counterHue).toBeLessThanOrEqual(329)
    }
  })

  it("keeps the lamp above and inboard of the title block", () => {
    const ids = Array.from({ length: 40 }, (_, i) => `req_${i}`)
    for (const id of ids) {
      const { x, y } = spotlightSeed(id)
      expect(x).toBeGreaterThanOrEqual(12)
      expect(x).toBeLessThanOrEqual(77)
      expect(y).toBeGreaterThanOrEqual(8)
      expect(y).toBeLessThanOrEqual(41)
    }
  })

  it("splits neighbouring seeds apart", () => {
    const ids = Array.from({ length: 12 }, (_, i) => `req_${i}`)
    const keys = ids.map((id) => {
      const seed = spotlightSeed(id)
      return `${seed.x}:${seed.y}:${seed.rx}:${seed.hue}`
    })
    expect(new Set(keys).size).toBeGreaterThan(1)
  })
})

describe("spotlightArtwork", () => {
  it("is a radial stack over a near-black base", () => {
    const art = spotlightArtwork(spotlightSeed("req_1"))
    const base = art.backgroundColor ?? ""
    expect(art.backgroundImage).toContain("radial-gradient")
    expect(base).toMatch(/^#[0-9a-f]+$/)
    // Near-black: background lightness stays below 4% at 2-digit hex depth.
    expect(parseInt(base.slice(-2), 16)).toBeLessThanOrEqual(13)
  })

  it("aims a light exactly where the seed puts it", () => {
    const seed = spotlightSeed("req_2")
    expect(spotlightArtwork(seed).backgroundImage).toContain(
      `at ${seed.x}% ${seed.y}%`
    )
  })

  it("edges fall to a fully opaque near-black stop", () => {
    expect(spotlightArtwork(spotlightSeed("req_3")).backgroundImage).toContain(
      "hsl(238 45% 3% / 1)"
    )
  })

  it("bleeds a counter-glow from the opposite side of its beam", () => {
    // Pick a seed whose beam is not dead-centre, so both corners differ.
    const seed = Array.from({ length: 40 }, (_, i) => spotlightSeed(`req_${i}`))
      .map((s, i) => ({ s, i }))
      .find(({ s }) => s.x !== 50)?.s
    if (!seed) return // coverage is asserted by the range tests above
    const art = spotlightArtwork(seed).backgroundImage ?? ""
    expect(art).toContain(`radial-gradient(ellipse 64% 52% at ${100 - seed.x}%`)
  })

  it("is stable per request and differs across requests", () => {
    expect(spotlightArtwork(spotlightSeed("req_9"))).toEqual(
      spotlightArtwork(spotlightSeed("req_9"))
    )
    expect(spotlightArtwork(spotlightSeed("req_9")).backgroundImage).not.toBe(
      spotlightArtwork(spotlightSeed("req_10")).backgroundImage
    )
  })
})

describe("SPOTLIGHT_GRAIN", () => {
  it("is two interfering dot grids, fixed in place", () => {
    const layers =
      (SPOTLIGHT_GRAIN.backgroundImage ?? "").split("radial-gradient").length -
      1
    expect(layers).toBe(2)
    expect(SPOTLIGHT_GRAIN.backgroundSize).toContain("3px")
    expect(SPOTLIGHT_GRAIN.backgroundSize).toContain("5px")
    expect(SPOTLIGHT_GRAIN.backgroundPosition).toBeDefined()
  })

  it("stays whisper-alpha: every dot below 0.08", () => {
    const alphas = [
      ...(SPOTLIGHT_GRAIN.backgroundImage ?? "").matchAll(
        /rgba\(255, ?255, ?255, ?([0-9.]+)\)/g
      ),
    ].map((match) => Number(match[1]))
    expect(alphas.length).toBeGreaterThan(0)
    for (const alpha of alphas) {
      expect(alpha).toBeLessThan(0.08)
      expect(alpha).toBeGreaterThan(0)
    }
  })
})

describe("messageLabel", () => {
  it("singularizes and pluralizes", () => {
    expect(messageLabel(1)).toBe("1 message")
    expect(messageLabel(2)).toBe("2 messages")
  })
})

describe("isDueEmphasis", () => {
  const past = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const future = new Date(Date.now() + 24 * 60 * 60 * 1000)

  it("lights up for overdue deadlines", () => {
    expect(isDueEmphasis(past, null)).toBe(true)
  })

  it("lights up for urgent, even if the date still holds", () => {
    expect(isDueEmphasis(future, "urgent")).toBe(true)
  })

  it("stays quiet for healthy, ordinary deadlines", () => {
    expect(isDueEmphasis(future, "low")).toBe(false)
    expect(isDueEmphasis(future, "high")).toBe(false)
  })

  it("never emphasises a missing deadline", () => {
    expect(isDueEmphasis(null, "urgent")).toBe(false)
  })
})
