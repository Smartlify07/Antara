/**
 * The arrival surface behind the auth testimonials.
 *
 * `photo` is the daylight studio shot with a top-to-bottom shade so the glass
 * card stays legible. `mesh` is the landing hero's sky field — same five
 * layers, base ramp rotated to 30deg by `.auth-mesh` — for the signup screen.
 * The grain is load-bearing in both: a ramp this shallow bands on 8-bit
 * displays without it (see DESIGN.md).
 */
export type AuthPanelVariant = "photo" | "mesh"

export function TestimonialBackdrop({
  variant,
}: {
  variant: AuthPanelVariant
}) {
  if (variant === "mesh") {
    return (
      <>
        <div
          aria-hidden
          className="hero-mesh auth-mesh absolute inset-0 animate-in duration-[1100ms] ease-out fade-in motion-reduce:animate-none"
        />
        <div
          aria-hidden
          className="hero-grain pointer-events-none absolute inset-0"
        />
      </>
    )
  }

  return (
    <>
      <img
        src="/media/daylight/studio-arch.webp"
        alt=""
        aria-hidden
        width={1400}
        height={2100}
        fetchPriority="high"
        className="absolute inset-0 size-full object-cover object-[50%_45%]"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/5"
      />
    </>
  )
}
