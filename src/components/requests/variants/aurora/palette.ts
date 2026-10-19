/**
 * Aurora palette — the lane-local colour system for the aurora variant.
 * Pure and deterministic: every request gets its own night sky, seeded by
 * its id, and every chip keeps the white-on-dark promise the gradient
 * scrim was built for.
 *
 * The sky reads dark overall: the base linear gradient (the bottom layer)
 * never rises above 16% lightness, so white text stands even where the
 * curtains glow brightest. That invariant is pinned down in
 * `palette.test.ts` — if you retune the sky, keep it.
 */
import type { CSSProperties } from "react"
import type { RequestListItem } from "@/server/services/request-service"
import type { RequestTriageStatus } from "@/db/enums"
import { hashString } from "../card-gradient"

/** A deterministic 0..1 sampler — independent salt streams off the id. */
function sample(id: string, salt: string): number {
  return (hashString(`${id}:${salt}`) % 1000) / 1000
}

/** The per-request parameters of one aurora night. */
export type AuroraSeed = {
  /** Night-sky base hue: deep indigo family, drifted per request. */
  skyHue: number
  /** Curtain hue: teal through violet, seeded per request. */
  curtainHue: number
  /** Where the curtain's second stop sits (varies the band's width). */
  curtainMid: number
  /** Sky sweep angle, drifted per request. */
  skyAngle: number
  /** Curtain centre: usually above the top edge, drifting side to side. */
  curtainX: number
  curtainY: number
  /** Counter-glow centre: low on the far side from the curtain. */
  glowX: number
  /** Hue spread inside the curtain band. */
  drift: number
}

/**
 * Derive one request's sky parameters. Same id, same sky, every render —
 * but busy grids never look tiled, because every axis drifts on its own
 * salt stream.
 */
export function auroraSeed(id: string): AuroraSeed {
  return {
    skyHue: 208 + Math.round(sample(id, "sky") * 62),
    curtainHue: 150 + Math.round(sample(id, "curtain") * 160),
    curtainMid: 38 + Math.round(sample(id, "curtain-mid") * 18),
    skyAngle: 152 + Math.round(sample(id, "angle") * 56),
    curtainX: 46 + Math.round(sample(id, "curtain-x") * 40),
    curtainY: -4 + Math.round(sample(id, "curtain-y") * 18),
    glowX: 8 + Math.round(sample(id, "glow-x") * 34),
    drift: 26 + Math.round(sample(id, "drift") * 34),
  }
}

/**
 * The aurora artwork, CSS-only: a soft counter-glow, a luminous curtain
 * band, and a dark indigo linear sky underneath it all (last-listed
 * background layer renders bottommost — the sky is what the glow mixes
 * into).
 */
export function auroraSky(request: Pick<RequestListItem, "id">): CSSProperties {
  const seed = auroraSeed(request.id)
  const curtainEdge = (seed.curtainHue + seed.drift) % 360
  const glowHue = (seed.curtainHue + 140) % 360
  return {
    backgroundImage: [
      `radial-gradient(115% 78% at ${seed.curtainX}% ${seed.curtainY}%, hsl(${seed.curtainHue} 65% 33% / 0.40) 0%, hsl(${curtainEdge} 52% 24% / 0.22) ${seed.curtainMid}%, transparent 74%)`,
      `radial-gradient(92% 66% at ${seed.glowX}% 106%, hsl(${glowHue} 45% 27% / 0.28) 0%, transparent 70%)`,
      `linear-gradient(${seed.skyAngle}deg, hsl(${seed.skyHue} 22% 15%) 0%, hsl(${(seed.skyHue + 12) % 360} 25% 11%) 45%, hsl(${(seed.skyHue + 26) % 360} 28% 8%) 100%)`,
    ].join(", "),
  }
}

/**
 * The white-on-dark chip ground every aurora chip shares. No ring colour
 * here — the state tint appends its own, so the cascade can't race two
 * ring colours on the same element.
 */
export const AURORA_CHIP =
  "rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-white/85 ring-1"

/** A plain side-by-side chip (category): neutral white ring. */
export const AURORA_CHIP_NEUTRAL = `${AURORA_CHIP} ring-white/15`

/**
 * Status, tinted only at the ring — the aurora way of keeping triage
 * legible without dragging in `REQUEST_META`'s light-surface badge
 * classes, which belong to page backgrounds, not night skies.
 */
const STATE_RING: Record<RequestTriageStatus, string> = {
  open: "ring-sky-300/30",
  needs_info: "ring-amber-300/30",
  accepted: "ring-emerald-300/30",
  declined: "ring-white/20",
}

/** Status chip: shared white ground + the state's ring tint. */
export function auroraStatusChipClass(status: RequestTriageStatus): string {
  return `${AURORA_CHIP} ${STATE_RING[status]}`
}

/**
 * The urgency chip for `priority === "urgent"`: a rose wash, a rose ring,
 * and a barely-there glow. Calm emphasis — louder than the white chips,
 * quieter than the sky it sits on.
 */
export const AURORA_URGENT_CHIP_CLASS =
  "rounded-full bg-rose-400/20 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-rose-100 ring-1 ring-rose-200/40 shadow-[0_0_12px_rgba(251,113,133,0.25)]"
