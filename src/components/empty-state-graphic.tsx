import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

/**
 * Bespoke isometric stack rendered in currentColor so it inherits the
 * theme. Animated with CSS only; disabled under reduced motion.
 */
export function EmptyStateGraphic({ className }: { className?: string }) {
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReduceMotion(query.matches)
    const onChange = (event: MediaQueryListEvent) =>
      setReduceMotion(event.matches)
    query.addEventListener("change", onChange)
    return () => query.removeEventListener("change", onChange)
  }, [])

  return (
    <div
      aria-hidden
      className={cn(
        "animate-in duration-500 fade-in-0 zoom-in-95",
        !reduceMotion && "animate-[float_5s_ease-in-out_infinite]",
        className
      )}
    >
      <svg
        viewBox="0 0 160 140"
        fill="none"
        className="size-28 text-foreground"
        role="presentation"
      >
        <defs>
          <linearGradient id="esg-top" x1="80" y1="14" x2="80" y2="70">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.16" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.07" />
          </linearGradient>
          <linearGradient id="esg-left" x1="16" y1="46" x2="80" y2="132">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.1" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.04" />
          </linearGradient>
          <linearGradient id="esg-right" x1="144" y1="46" x2="80" y2="132">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.13" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {/* Base slab */}
        <path
          d="M80 26 148 62 80 98 12 62 80 26Z"
          fill="url(#esg-top)"
          stroke="currentColor"
          strokeOpacity="0.18"
          strokeWidth="1.5"
        />
        <path
          d="M12 62 80 98 80 132 12 96 12 62Z"
          fill="url(#esg-left)"
          stroke="currentColor"
          strokeOpacity="0.18"
          strokeWidth="1.5"
        />
        <path
          d="M148 62 80 98 80 132 148 96 148 62Z"
          fill="url(#esg-right)"
          stroke="currentColor"
          strokeOpacity="0.18"
          strokeWidth="1.5"
        />

        {/* Stacked card, offset for depth */}
        <g transform="translate(0 -26)">
          <path
            d="M80 34 132 62 80 90 28 62 80 34Z"
            fill="url(#esg-top)"
            stroke="currentColor"
            strokeOpacity="0.24"
            strokeWidth="1.5"
          />
          <path
            d="M28 62 80 90 80 108 28 80 28 62Z"
            fill="url(#esg-left)"
            stroke="currentColor"
            strokeOpacity="0.24"
            strokeWidth="1.5"
          />
          <path
            d="M132 62 80 90 80 108 132 80 132 62Z"
            fill="url(#esg-right)"
            stroke="currentColor"
            strokeOpacity="0.24"
            strokeWidth="1.5"
          />
        </g>

        {/* Spark */}
        <path
          d="M118 16v10M113 21h10"
          stroke="currentColor"
          strokeOpacity="0.35"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M36 30v7M32.5 33.5h7"
          stroke="currentColor"
          strokeOpacity="0.22"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}
