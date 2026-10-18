/**
 * Shared ground for the request-card variants. Everything here is pure so
 * variants can compose freely: a stable per-request seed, the default dark
 * gradient built from it, and the white-on-gradient text tokens the cards
 * must use so every variation stays readable over its own artwork.
 *
 * Variant folders are free to build richer gradients from `hashString` —
 * the tokens are the load-bearing part.
 */
import type { CSSProperties } from "react"
import type { RequestListItem } from "@/server/services/request-service"

/** Deterministic, seedable hash — same request, same artwork, every render. */
export function hashString(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/**
 * The default card gradient: a dark, slightly hue-shifted sweep seeded by
 * the request id. Dark enough that white text never relies on luck.
 */
export function requestGradient(request: Pick<RequestListItem, "id">): CSSProperties {
  const hue = hashString(request.id) % 360
  return {
    backgroundImage: `linear-gradient(150deg, hsl(${hue} 45% 30%) 0%, hsl(${(hue + 24) % 360} 40% 20%) 45%, hsl(${(hue + 210) % 360} 30% 12%) 100%)`,
  }
}

/** A legibility scrim layered above any variant's artwork. */
export const GRADIENT_SCRIM_CLASS =
  "absolute inset-0 bg-gradient-to-t from-black/55 via-black/25 to-black/10"

/**
 * Text tokens for over-gradient surfaces. Variants may re-space, not
 * re-colour: these carry the contrast promise.
 */
export const GRADIENT_TEXT = {
  title: "text-white font-medium tracking-tight",
  meta: "text-white/75",
  chip: "bg-white/10 text-white/85",
  muted: "text-white/55",
  accent: "text-white/90 font-medium",
  urgent:
    "bg-rose-500/25 text-white ring-1 ring-white/30 backdrop-blur-[2px]",
} as const
