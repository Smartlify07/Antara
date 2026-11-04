import { useId } from "react"
import { cn } from "@/lib/utils"
import { projectCoverColor } from "@/lib/project-cover"

/**
 * Card artwork for a project. Uses the persisted accent color; falls back
 * to a bright color derived from the slug when none is set.
 *
 * Solid fill by design — earlier revisions layered radial gradients, which
 * read as noise behind the status badge.
 */

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
  const background = projectCoverColor(seed, gradient)
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
