import { hash } from "@/lib/hash"

/**
 * Card artwork colour for a project. Uses the persisted accent when set;
 * otherwise a bright colour derived from the seed. Solid fill by design —
 * layered radial gradients read as noise behind the status badge.
 */

/** Bright fills, kept in the same lightness band so cards feel like a set. */
const BRIGHT_COLORS = [
  "oklch(0.72 0.19 350)", // pink
  "oklch(0.74 0.17 25)", // coral
  "oklch(0.78 0.17 70)", // amber
  "oklch(0.80 0.16 130)", // lime
  "oklch(0.75 0.16 165)", // teal
  "oklch(0.72 0.16 250)", // blue
  "oklch(0.73 0.18 300)", // violet
  "oklch(0.76 0.18 15)", // red
]

export function projectCoverColor(
  seed: string,
  gradient?: { start: string | null; end: string | null } | null
): string {
  return gradient?.start ?? BRIGHT_COLORS[hash(seed) % BRIGHT_COLORS.length]!
}
