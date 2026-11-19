import { InfiniteSlider } from "@/components/ui/motion-primitives/infinite-slider"
import { cn } from "@/lib/utils"

/**
 * Client wordmarks at the foot of the landing page. One marquee at every
 * width; the side mask is what lets it run edge to edge without a hard cut.
 * Fictional studios, so the strip can be populated with real customers later
 * without retracting anything.
 */
const studios = [
  { name: "Framehouse", className: "text-xl font-semibold tracking-tight" },
  { name: "PIXEL&CO.", className: "text-lg font-bold tracking-widest" },
  { name: "Reelworks", className: "font-heading text-xl font-medium italic" },
  {
    name: "STUDIO VELA",
    className: "text-base font-semibold tracking-[0.25em]",
  },
  { name: "Hueform", className: "font-heading text-2xl font-light" },
  {
    name: "Cutroom",
    className: "text-xl font-semibold lowercase tracking-tight",
  },
]

export default function LogoCloud() {
  return (
    <section className="bg-background" aria-label="Studios using Antara">
      <div className="mx-auto max-w-7xl lg:px-6">
        <InfiniteSlider
          gap={44}
          speed={40}
          className="mask-x-from-88% mask-x-to-99% py-10 lg:py-12"
        >
          {studios.map((studio) => (
            <span
              key={studio.name}
              className={cn(
                "shrink-0 whitespace-nowrap text-muted-foreground/80 **:fill-foreground",
                studio.className
              )}
            >
              {studio.name}
            </span>
          ))}
        </InfiniteSlider>
      </div>
    </section>
  )
}
