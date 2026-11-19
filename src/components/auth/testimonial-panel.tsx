import { useEffect, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { cn } from "@/lib/utils"
import { Logo } from "@/components/logo"
import { testimonials } from "./testimonials"
import { TestimonialBackdrop } from "./testimonial-backdrop"
import type { AuthPanelVariant } from "./testimonial-backdrop"

const ROTATE_MS = 6500

/**
 * The arrival surface for auth. One backdrop, one floating glass card: the
 * surface carries the atmosphere, the card carries the proof. Signup swaps the
 * photograph for the hero's sky mesh at its own angle; login keeps the photo.
 */
export function TestimonialPanel({
  variant = "photo",
}: {
  variant?: AuthPanelVariant
}) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (paused || reduceMotion) return
    const id = setInterval(
      () => setIndex((i) => (i + 1) % testimonials.length),
      ROTATE_MS
    )
    return () => clearInterval(id)
  }, [paused, reduceMotion])

  const active = testimonials[index]

  return (
    <aside
      className={cn(
        "relative hidden min-h-svh overflow-hidden lg:block",
        variant === "photo" ? "bg-[#eee9e1]" : "bg-[#f0f9ff]"
      )}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Customer testimonials"
    >
      <TestimonialBackdrop variant={variant} />

      <div className="absolute top-7 left-6 inline-flex items-center gap-2 rounded-full bg-black/55 px-3 py-2 text-white ring-1 ring-white/15 backdrop-blur-xl sm:left-10">
        <Logo className="size-4 text-brand" />
        <span className="text-sm font-semibold tracking-tight">Antara</span>
      </div>

      <div className="relative flex h-full min-h-svh flex-col justify-end p-6 xl:p-10">
        <div className="max-w-md rounded-[30px] bg-black/55 p-6 text-white ring-1 ring-white/15 backdrop-blur-2xl xl:p-8">
          <AnimatePresence mode="wait">
            <motion.figure
              key={index}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -12 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              <blockquote className="text-[17px] leading-snug font-medium text-balance xl:text-lg">
                &ldquo;{active.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-5 flex items-center gap-3">
                <span
                  aria-hidden
                  className="flex size-9 items-center justify-center rounded-full bg-white/15 text-[11px] font-semibold tracking-wide text-white ring-1 ring-white/20 ring-inset"
                >
                  {active.initials}
                </span>
                <div>
                  <div className="text-sm font-semibold">{active.name}</div>
                  <div className="text-xs text-white/60">
                    {active.role}, {active.studio}
                  </div>
                </div>
              </figcaption>
            </motion.figure>
          </AnimatePresence>

          <div
            className="mt-6 flex items-center gap-2"
            role="tablist"
            aria-label="Testimonials"
          >
            {testimonials.map((t, i) => (
              <button
                key={t.name}
                role="tab"
                aria-selected={i === index}
                aria-label={`Show testimonial from ${t.name}`}
                onClick={() => setIndex(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i === index
                    ? "w-6 bg-white"
                    : "w-1.5 bg-white/30 hover:bg-white/50"
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </aside>
  )
}
