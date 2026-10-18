import { describe, expect, it } from "vitest"
import type { RequestTriageStatus } from "@/db/enums"
import {
  DUOTONE_STATE_KEYS,
  duotoneGradient,
  duotoneStops,
  stateAccentCss,
  stateTones,
} from "./state-palette"
import { hashString } from "../card-gradient"

/**
 * The duotone promise: state carries the hue, request carries only the
 * geometry, and every stop stays dark enough that white text never depends
 * on luck.
 */
describe("stateTones", () => {
  it("maps each triage state to a distinct hue", () => {
    const hues = DUOTONE_STATE_KEYS.map((status) => stateTones(status).hue)
    expect(DUOTONE_STATE_KEYS).toHaveLength(4)
    expect(new Set(hues).size).toBe(4)
  })

  it("keeps declined dimmer than the live states", () => {
    expect(stateTones("declined").sat).toBeLessThan(stateTones("open").sat)
  })

  it("falls back to the open palette for an unknown status", () => {
    expect(stateTones("mystery")).toEqual(stateTones("open"))
  })
})

describe("duotoneStops", () => {
  it.each(DUOTONE_STATE_KEYS)("%s has a dark band for white text", (status) => {
    const { light, dark } = duotoneStops(status, hashString("req_sample"))
    expect(light.l).toBeLessThanOrEqual(26)
    expect(dark.l).toBeLessThanOrEqual(13)
  })

  it("is deterministic for the same seed", () => {
    expect(duotoneStops("open", 1234)).toEqual(duotoneStops("open", 1234))
  })

  it("drifts per request but never leaves the dark band", () => {
    const faces = Array.from(
      { length: 12 },
      (_, i) => duotoneStops("open", i * 7919).light
    )
    expect(new Set(faces.map((stop) => stop.l)).size).toBeGreaterThan(1)
    expect(Math.max(...faces.map((stop) => stop.l))).toBeLessThanOrEqual(26)
  })

  it("keeps both stops on one hue — duotone, not rainbow", () => {
    const { light, dark } = duotoneStops("accepted", 9)
    expect(light.h).toBe(dark.h)
  })

  it("never drops saturation to gray", () => {
    const { light } = duotoneStops("declined", 0)
    expect(light.s).toBeGreaterThanOrEqual(14)
  })
})

describe("duotoneGradient", () => {
  const request = (id: string, triageStatus: RequestTriageStatus) => ({
    id,
    triageStatus,
  })

  it("is stable per request", () => {
    expect(duotoneGradient(request("req_1", "open"))).toEqual(
      duotoneGradient(request("req_1", "open"))
    )
  })

  it("is a two-stop diagonal", () => {
    const css = duotoneGradient(request("req_1", "open")).backgroundImage ?? ""
    expect(css).toContain("linear-gradient(")
    expect(css.match(/hsl\(/g)).toHaveLength(2)
  })

  it("coordinates the state hue into the stops", () => {
    const css =
      duotoneGradient(request("req_1", "needs_info")).backgroundImage ?? ""
    expect(css).toMatch(/hsl\(40 \d+% \d+%\)/)
  })

  it("sweeps the angle within 110–170° per request", () => {
    for (let i = 0; i < 20; i++) {
      const css =
        duotoneGradient(request(`req_${i}`, "open")).backgroundImage ?? ""
      const angle = Number(css.match(/(\d+)deg/)![1])
      expect(angle).toBeGreaterThanOrEqual(110)
      expect(angle).toBeLessThanOrEqual(170)
    }
  })

  it("differs across requests of the same state", () => {
    expect(duotoneGradient(request("req_1", "open"))).not.toEqual(
      duotoneGradient(request("req_2", "open"))
    )
  })
})

describe("stateAccentCss", () => {
  it("lifts the state hue above the card band for the glyph", () => {
    expect(stateAccentCss("open")).toBe("hsl(205 54% 62%)")
    expect(stateAccentCss("declined")).toBe("hsl(250 20% 62%)")
  })
})
