import { Link } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { Logo } from "@/components/logo"
import { HeroMobileMenu } from "@/components/hero-mobile-menu"
import { cn } from "@/lib/utils"

const links = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
]

/**
 * The notch, pinned to the top edge of the viewport for the whole page. It is
 * not a floating bar: the body hangs flush from the top edge and the two
 * .notch-fillet squares carry the inverse radius out into whatever is behind
 * it — the hero gradient first, then the paper sections. See styles.css.
 *
 * Width is viewport-linked (84vw) with a 660px cap, so it stays a fixed
 * proportion of the page while the page has room to give it.
 */
export function SiteNotchNav() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const root = document.documentElement
    const previous = root.style.overflow
    root.style.overflow = "hidden"

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", onKeyDown)

    return () => {
      root.style.overflow = previous
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  return (
    <>
      <header className="fixed top-0 left-1/2 z-50 w-[min(84vw,41.25rem)] -translate-x-1/2 [--notch-fillet:16px] [--notch-ink:#0a0a0a]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 [filter:drop-shadow(0_16px_32px_rgb(10_10_10/0.28))]"
        >
          <span className="absolute inset-0 rounded-b-[18px] bg-[#0a0a0a]" />
          <span className="notch-fillet notch-fillet--left" />
          <span className="notch-fillet notch-fillet--right" />
        </div>

        <nav className="relative flex h-14 items-center justify-between px-3.5 md:h-16 md:px-5">
          <Link
            to="/"
            aria-label="Antara home"
            className="flex items-center gap-2"
            onClick={() => setOpen(false)}
          >
            <Logo className="size-5 text-brand" />
            <span className="text-[15px] font-semibold tracking-[-0.02em] text-white">
              Antara
            </span>
          </Link>

          <ul className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-0.5 md:flex">
            {links.map((item) => (
              <li key={item.label}>
                <a
                  href={item.href}
                  className="rounded-full px-2.5 py-1.5 text-[13px] text-white/65 transition-colors hover:bg-white/10 hover:text-white"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="hidden items-center gap-1 md:flex">
            <Link
              to="/login"
              search={{ callbackURL: undefined }}
              className="rounded-full px-2.5 py-1.5 text-[13px] text-white/65 transition-colors hover:text-white"
            >
              Log in
            </Link>
            <Link
              to="/signup"
              search={{ callbackURL: undefined }}
              className="rounded-full bg-white px-3.5 py-1.5 text-[12.5px] font-medium text-[#0a0a0a] transition-colors hover:bg-white/90"
            >
              Sign up
            </Link>
          </div>

          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="hero-mobile-menu"
            onClick={() => setOpen((value) => !value)}
            className="relative -mr-1 flex size-9 items-center justify-center md:hidden"
          >
            <span className="relative flex size-5 flex-col items-center justify-center">
              <span
                className={cn(
                  "absolute h-px w-4.5 bg-white transition-transform duration-200 motion-reduce:transition-none",
                  open ? "rotate-45" : "-translate-y-[3px]"
                )}
              />
              <span
                className={cn(
                  "absolute h-px w-4.5 bg-white transition-transform duration-200 motion-reduce:transition-none",
                  open ? "-rotate-45" : "translate-y-[3px]"
                )}
              />
            </span>
          </button>
        </nav>
      </header>

      {open && <HeroMobileMenu onNavigate={() => setOpen(false)} />}
    </>
  )
}
