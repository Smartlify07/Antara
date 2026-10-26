import { useMedia } from "@/hooks/use-media"
import { InfiniteSlider } from "@/components/ui/motion-primitives/infinite-slider"
import { cn } from "@/lib/utils"

/**
 * Placeholder client wordmarks for the logo cloud. Fictional studios, so the
 * cloud can be populated with real customers later without retracting
 * anything.
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
  const isLarge = useMedia("(min-width: 64rem)")

  const Logos = () => {
    return (
      <>
        {studios.map((studio) => (
          <span
            key={studio.name}
            className={cn(
              "shrink-0 px-2 whitespace-nowrap text-muted-foreground/80 **:fill-foreground",
              studio.className
            )}
          >
            {studio.name}
          </span>
        ))}
      </>
    )
  }

  return (
    <section className="bg-background">
      <div className="relative m-auto max-w-7xl **:fill-foreground lg:px-6">
        {isLarge ? (
          <div className="relative flex items-center justify-between px-6 py-12">
            <Logos />
          </div>
        ) : (
          <InfiniteSlider
            gap={44}
            className="mask-x-from-85% mask-x-to-99% py-8 *:[&>svg]:scale-80"
          >
            <Logos />
          </InfiniteSlider>
        )}
      </div>
    </section>
  )
}
