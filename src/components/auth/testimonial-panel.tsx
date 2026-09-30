import { useEffect, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { cn } from "@/lib/utils"
import { Logo } from "@/components/logo"
import { testimonials } from "./testimonials"

const ROTATE_MS = 6500

export function TestimonialPanel() {
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

  const active = testimonials[index]!

  return (
    <aside
      className="relative hidden overflow-hidden bg-primary text-primary-foreground lg:block"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Customer testimonials"
    >
      {/* Backdrop layers: glow + grid + watermark, all token-derived. */}
      <div
        aria-hidden
        className="absolute -top-32 -right-32 size-[28rem] rounded-full bg-primary-foreground/[0.07] blur-3xl"
      />
      <div
        aria-hidden
        className="absolute -bottom-40 -left-24 size-[24rem] rounded-full bg-primary-foreground/[0.05] blur-3xl"
      />
      <div
        aria-hidden
        className="absolute inset-0 [background-image:linear-gradient(to_right,var(--color-primary-foreground)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-primary-foreground)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_40%,black,transparent)] [background-size:2.5rem_2.5rem] opacity-[0.13]"
      />
      <div
        aria-hidden
        className="absolute -top-10 left-6 font-serif text-[16rem] leading-none text-primary-foreground/10 select-none"
      >
        &ldquo;
      </div>

      <div className="absolute top-0 right-0 flex items-center gap-2 p-10 xl:p-14">
        <Logo className="size-7" />
        <span className="text-lg font-medium tracking-tight">Antara</span>
      </div>

      <div className="relative flex h-full flex-col justify-end p-10 xl:p-14">
        <AnimatePresence mode="wait">
          <motion.figure
            key={index}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -24 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
          >
            <div className="mb-6 flex items-center gap-3">
              <span
                aria-hidden
                className="flex size-11 items-center justify-center rounded-full bg-primary-foreground/15 text-sm font-semibold tracking-wide text-primary-foreground ring-1 ring-white/20 ring-inset"
              >
                {active.initials}
              </span>
              <figcaption>
                <div className="text-sm font-semibold">{active.name}</div>
                <div className="text-xs text-primary-foreground/70">
                  {active.role}, {active.studio}
                </div>
              </figcaption>
            </div>
            <blockquote className="max-w-md text-lg leading-relaxed font-medium text-balance xl:text-xl">
              &ldquo;{active.quote}&rdquo;
            </blockquote>
          </motion.figure>
        </AnimatePresence>

        <div
          className="mt-8 flex items-center gap-2"
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
                  ? "w-6 bg-primary-foreground"
                  : "w-1.5 bg-primary-foreground/30 hover:bg-primary-foreground/50"
              )}
            />
          ))}
        </div>
      </div>
    </aside>
  )
}
