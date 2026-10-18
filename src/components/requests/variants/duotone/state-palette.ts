/**
 * The duotone palette: pure color geometry for the variant.
 *
 * The rule the whole variant hangs on: the STATE is the hue, the REQUEST is
 * the geometry. A card is a strict two-stop diagonal — a lit face and a deep
 * recess of the same state hue — and per-request variation comes only from
 * the sweep angle and a small saturation/lightness drift seeded by
 * `hashString`. Nothing here knows about JSX, so everything is testable.
 */
import type { CSSProperties } from "react"
import type { RequestListItem } from "@/server/services/request-service"
import { hashString } from "../card-gradient"

export type ToneStop = { h: number; s: number; l: number }

/**
 * State → base hue/saturation. Hue carries the queue's vocabulary:
 * sky = fresh work, amber = waiting on someone, emerald = going ahead,
 * dim indigo = parked. Declined is deliberately desaturated so parked work
 * recedes against the live states.
 */
const STATE_TONES: Record<string, { hue: number; sat: number }> = {
  open: { hue: 205, sat: 54 },
  needs_info: { hue: 40, sat: 58 },
  accepted: { hue: 155, sat: 46 },
  declined: { hue: 250, sat: 20 },
}

/** The four real states, for tests and the accent glyph. */
export const DUOTONE_STATE_KEYS = Object.keys(STATE_TONES)

const FALLBACK = STATE_TONES.open

export function stateTones(status: string): { hue: number; sat: number } {
  return STATE_TONES[status] ?? FALLBACK
}

/**
 * Both stops of the card gradient: darker than the band white text can
 * safely sit on (face ≤ 26% lightness, recess ≤ 13%), with a ±saturation
 * drift so a wall of open requests isn't one flat rectangle.
 */
export function duotoneStops(
  status: string,
  seed: number
): { light: ToneStop; dark: ToneStop } {
  const { hue, sat } = stateTones(status)
  const lightL = 23 + (seed % 4) // 23–26
  const darkL = 11 + ((seed >> 3) % 3) // 11–13
  const satDrift = ((seed >> 6) % 9) - 4 // −4…+4
  const s = Math.max(14, sat + satDrift)
  return {
    light: { h: hue, s, l: lightL },
    dark: { h: hue, s, l: darkL },
  }
}

/**
 * The card artwork: one two-stop diagonal, state-hued, angle swept through
 * 110–170° by the request seed.
 */
export function duotoneGradient(
  request: Pick<RequestListItem, "id" | "triageStatus">
): CSSProperties {
  const seed = hashString(request.id)
  const { light, dark } = duotoneStops(request.triageStatus, seed)
  const angle = 110 + (seed % 61) // 110–170°
  return {
    backgroundImage: `linear-gradient(${angle}deg, hsl(${light.h} ${light.s}% ${light.l}%) 0%, hsl(${dark.h} ${dark.s}% ${dark.l}%) 100%)`,
  }
}

/**
 * The accent tint for the state glyph: the state hue lifted above the
 * card's own band so the glyph reads against the white/10 chip.
 */
export function stateAccentCss(status: string): string {
  const { hue, sat } = stateTones(status)
  return `hsl(${hue} ${sat}% 62%)`
}
