/**
 * Variant `spotlight` — the pure light rig (no React).
 *
 * One idea: every request stands on a stage and a lamp is aimed at it. The
 * id seeds the whole rig — the beam's hue, position, and reach drift apart
 * so two neighbouring cards never cast the same shadow — while the room
 * around the subject always falls to near-black. Two constraints keep the
 * result legible and honest:
 *
 * - The artwork never paints in the rose band of hue (30°–329°): rose on a
 *   card means "late / urgent", so the stage never muddies that vocabulary.
 * - Every overlay is whisper-alpha: text must always out-punch texture.
 */
import type { CSSProperties } from "react"
import type { TaskPriority } from "@/db/enums"
import { isOverdue } from "@/lib/time"
import { hashString } from "../card-gradient"

/** Beam hue spread: 30° (amber) → 329° (violet). The rose band stays out. */
const HUE_MIN = 30
const HUE_SPAN = 300

/** The stage's base tone — near-black, a touch blue. */
const STAGE_BACKDROP = "#07080d"
/** Near-black ink for the vignette + reading pit, so edges never shift hue. */
const DARK = "238 45% 3%"

export type SpotlightSeed = {
  /** Beam hue, inside the non-rose band [30, 329]. */
  hue: number
  /** Beam center, % of card. */
  x: number
  y: number
  /** Beam radii, % of card. */
  rx: number
  ry: number
  /** The counter-glow breathes from its own hue in the same band. */
  counterHue: number
}

/** A hue cycle bounded to the stage palette (negative deltas included). */
function shiftHueInBand(hue: number, delta: number): number {
  const offset = (((hue - HUE_MIN + delta) % HUE_SPAN) + HUE_SPAN) % HUE_SPAN
  return HUE_MIN + offset
}

/**
 * Aim the light: independent bit-slices of the id's hash drive position,
 * size, and hue, so the seeds spread across cards instead of marching.
 */
export function spotlightSeed(id: string): SpotlightSeed {
  const h = hashString(id)
  return {
    hue: HUE_MIN + (h % HUE_SPAN),
    x: 12 + ((h >>> 5) % 66),
    y: 8 + ((h >>> 13) % 34),
    rx: 88 + ((h >>> 20) % 33),
    ry: 62 + ((h >>> 24) % 29),
    counterHue: HUE_MIN + ((h >>> 4) % HUE_SPAN),
  }
}

/**
 * The layered rig, top stop to base:
 *
 * 1. vignette — the room falls away, near-black at the edges
 * 2. lamp core — the hot pool right where the beam lands
 * 3. the beam — broad, hue-shifted from core to rim
 * 4. reading pit — a darker pool where the title sits, so words beat art
 * 5. floor bounce — a faint reflection washing along the base
 * 6. counter-glow — one breath of cooler light from the far corner
 */
export function spotlightArtwork(seed: SpotlightSeed): CSSProperties {
  const rim = shiftHueInBand(seed.hue, 46)
  return {
    backgroundColor: STAGE_BACKDROP,
    backgroundImage: [
      `radial-gradient(ellipse 145% 125% at 50% 38%, hsl(${DARK} / 0) 40%, hsl(${DARK} / 0.72) 78%, hsl(${DARK} / 1) 97%)`,
      `radial-gradient(ellipse 36% 32% at ${seed.x}% ${seed.y}%, hsl(${seed.hue} 85% 62% / 0.34) 0%, hsl(${seed.hue} 85% 62% / 0) 100%)`,
      `radial-gradient(ellipse ${seed.rx}% ${seed.ry}% at ${seed.x}% ${seed.y}%, hsl(${seed.hue} 62% 36%) 0%, hsl(${rim} 52% 15% / 0.95) 55%, hsl(${rim} 45% 7% / 0) 100%)`,
      `radial-gradient(ellipse 125% 60% at 50% 62%, hsl(${DARK} / 0.55) 0%, hsl(${DARK} / 0) 76%)`,
      `radial-gradient(ellipse 92% 38% at 50% 116%, hsl(${seed.hue} 42% 44% / 0.2) 0%, hsl(${seed.hue} 42% 44% / 0) 74%)`,
      `radial-gradient(ellipse 64% 52% at ${100 - seed.x}% ${Math.min(seed.y + 46, 96)}%, hsl(${seed.counterHue} 55% 32% / 0.32) 0%, hsl(${seed.counterHue} 55% 32% / 0) 76%)`,
    ].join(", "),
  }
}

/**
 * CSS-only film grain: two offset dot grids interfere into pseudo-random
 * stipple. Whisper-alpha on purpose — texture, never fog, no images, no deps.
 */
export const SPOTLIGHT_GRAIN: CSSProperties = {
  backgroundImage: [
    "radial-gradient(rgba(255, 255, 255, 0.05) 0.75px, transparent 0.75px)",
    "radial-gradient(rgba(255, 255, 255, 0.035) 0.6px, transparent 0.6px)",
  ].join(", "),
  backgroundSize: "3px 3px, 5px 5px",
  backgroundPosition: "0 0, 1.2px 0.7px",
}

/** "1 message" / "N messages" — the footer and thread count agree. */
export function messageLabel(count: number): string {
  return `${count} ${count === 1 ? "message" : "messages"}`
}

/**
 * When the footer's deadline gets the calm rose emphasis: overdue, or
 * stamped urgent. Everything else stays quiet.
 */
export function isDueEmphasis(
  dueDate: Date | null,
  priority: TaskPriority | null
): boolean {
  return dueDate !== null && (isOverdue(dueDate) || priority === "urgent")
}
