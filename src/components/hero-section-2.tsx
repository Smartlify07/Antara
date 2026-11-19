import { Link } from "@tanstack/react-router"
import { ArrowUpRight, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { HeroAppPreview } from "@/components/hero-app-preview"

/**
 * The hero fill is a mesh of three sky stops — `#38bdf8`, `#bae6fd`,
 * `#f0f9ff` — plus a grain film. It lives in `styles.css` (`.hero-mesh`,
 * `.hero-grain`); keeping it there is what allows multiple radial fields
 * instead of one linear ramp, and the grain is what stops the shallow ramp
 * from banding. There is no dark stop, so the copy is ink, not white.
 */

/**
 * Full-bleed hero: an authored gradient runs edge to edge and the copy sits in
 * the same max-w-7xl / px-6 column as every section below it. The notch is not
 * rendered here — it is pinned at the viewport top by the landing route, so it
 * stays put once this section has scrolled away.
 *
 * Below it, the product mockup sits on the meadow, fading in from the flat
 * `--hero-lift` the hero ends on, so the two sections share one edge instead of
 * meeting at a line.
 */
export default function HeroSection() {
  return (
    <>
      <section className="relative flex min-h-svh flex-col overflow-hidden bg-[#bae6fd]">
        <div
          aria-hidden
          className="hero-mesh absolute inset-0 animate-in duration-[1100ms] ease-out fade-in motion-reduce:animate-none"
        />
        <div
          aria-hidden
          className="hero-grain pointer-events-none absolute inset-0"
        />

        <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center px-6 pt-32 pb-24 text-center">
          <h1 className="max-w-[17.5em] text-[clamp(2.5rem,6.4vw,5.5rem)] leading-[0.94] font-semibold tracking-[-0.045em] text-balance text-[#0a0a0a]">
            Work finds its place.
            <span className="mt-1 block font-display text-[calc(clamp(2.5rem,6.4vw,5.5rem)-4px)] leading-[1.02] font-normal tracking-[-0.025em] text-balance text-[#0a0a0a] italic">
              Nothing lost.
            </span>
          </h1>

          <p className="mt-8 max-w-xl text-[17px] leading-relaxed text-pretty text-[#2c4650]">
            Tasks, files, and feedback stay with the project. Your team stops
            chasing the latest version across chat threads and shared drives.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button
              asChild
              className="h-12 rounded-2xl bg-[#0a0a0a] px-6 text-[15px] text-white hover:bg-[#0a0a0a]/85"
            >
              <Link to="/signup" search={{ callbackURL: undefined }}>
                Start your first project
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              className="h-12 rounded-2xl px-5 text-[15px] text-[#0a0a0a] ring-1 ring-black/15 ring-inset hover:bg-black/5 hover:text-[#0a0a0a]"
            >
              <a href="#features">
                See how it works
                <ArrowUpRight />
              </a>
            </Button>
          </div>

          <p className="mt-5 flex items-center gap-2 text-xs text-[#3d5761]">
            <Check className="size-3.5 text-brand" />
            Free to start, no card required.
          </p>
        </div>
      </section>

      {/* Mockup on the meadow. The top of this section is the exact colour the
          hero ends on, so there is no seam; the photograph emerges underneath
          it and is gone again by the time the next section starts. */}
      <section className="relative overflow-hidden bg-background">
        <img
          src="/media/daylight/hero-meadow.jpg"
          alt=""
          width={3000}
          height={2000}
          loading="lazy"
          className="absolute inset-0 size-full object-cover object-[50%_28%]"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-b from-[var(--hero-lift)] via-[var(--hero-lift)]/55 via-45% to-transparent"
        />
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-52 bg-gradient-to-t from-background to-transparent"
        />

        <div className="relative mx-auto max-w-6xl px-4 py-32 sm:px-6 md:py-24">
          <div className="rounded-[1.75rem] bg-[#0a0a0a] p-2 shadow-[0_60px_140px_-40px_rgb(6_30_24/0.55)]">
            <div className="overflow-hidden rounded-[1.25rem] bg-background">
              <HeroAppPreview />
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
