import { useId } from "react"
import { cn } from "@/lib/utils"

/**
 * Card artwork for a project. Uses the persisted accent color; falls back
 * to a bright color derived from the slug when none is set.
 *
 * Solid fill by design — earlier revisions layered radial gradients, which
 * read as noise behind the status badge.
 */

function hash(value: string): number {
  let h = 2166136261
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

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

export function ProjectCoverArt({
  seed,
  gradient,
  className,
}: {
  seed: string
  /** Persisted color stops. `start` is used as a solid fill. */
  gradient?: { start: string | null; end: string | null } | null
  className?: string
}) {
  const fallback = BRIGHT_COLORS[hash(seed) % BRIGHT_COLORS.length]!
  const background = gradient?.start ?? fallback
  // Unique per card: duplicate SVG filter ids would collide across the grid.
  const grainId = useId().replace(/:/g, "")

  return (
    <div
      aria-hidden
      className={cn("relative w-full overflow-hidden", className)}
      style={{ backgroundColor: background }}
    >
      {/* Grain overlay: breaks up the flat fill so large areas don't band. */}
      <svg className="absolute inset-0 size-full" role="presentation">
        <filter id={grainId} x="0" y="0" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves="4"
            stitchTiles="stitch"
            result="noise"
          />
          <feColorMatrix
            in="noise"
            type="saturate"
            values="0"
            result="desaturated"
          />
        </filter>
        <rect
          width="100%"
          height="100%"
          filter={`url(#${grainId})`}
          opacity="0.18"
          style={{ mixBlendMode: "overlay" }}
        />
      </svg>
    </div>
  )
}
