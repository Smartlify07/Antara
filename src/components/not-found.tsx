import { Link, useRouter } from "@tanstack/react-router"
import { ArrowLeftIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"

/**
 * The root 404. This is the one page that renders for a URL nobody planned
 * for — possibly a stale client link, possibly a bookmarked page that was
 * renamed — so it carries the brand alone: no auth gate, no workspace data,
 * no shell. It renders server-side before hydration, which shapes the whole
 * approach — every trick below is CSS or post-mount state, never browser
 * APIs at module scope, so the server HTML is already the finished page.
 *
 * The backdrop is the testimonial panel's grid, inverted for the light
 * theme: the same 2.5rem grid, the same radial mask, both derived from
 * tokens. That echo is deliberate — a dead URL should feel like it landed
 * inside the product's front door, not in an error report.
 *
 * Recovery is two moves. The primary action is `/dashboard`, which is the
 * landing resolver — for anyone signed in it redirects to the workspace they
 * last opened, which makes "Back to your workspace" true even when we have no
 * idea where they came from. The quieter action is history back, for someone
 * who clicked a dead link from somewhere real. Whether that button exists at
 * all is decided after mount, from the router's own `canGoBack` (which reads
 * the entry index TanStack writes into history state) — on first paint, fresh
 * visits, and SSR it isn't rendered, because there is nothing to go back to.
 */
export function NotFoundPage() {
  const router = useRouter()
  const [canGoBack, setCanGoBack] = useState(false)

  // Not at module scope and not during render: the route is server-rendered,
  // so any window or history access here would mismatch on hydration. Mirrors
  // the post-mount localStorage read in the verify-email page.
  useEffect(() => {
    setCanGoBack(router.history.canGoBack())
  }, [router])

  return (
    <main className="relative flex min-h-svh flex-col overflow-hidden bg-background">
      {/* Backdrop: the testimonial panel's grid, inverted for the light theme
          — token-derived, fading out radially so the type zone stays clean.
          Static by design; the entrance carries the motion. */}
      <div
        aria-hidden
        className="absolute inset-0 [background-image:linear-gradient(to_right,var(--color-foreground)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-foreground)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_75%_65%_at_50%_42%,black,transparent)] [background-size:2.5rem_2.5rem] opacity-[0.05]"
      />

      <div className="relative flex flex-1 flex-col items-center justify-center px-6 py-16 text-center sm:py-24">
        <h1 className="sr-only">Page not found</h1>

        {/* Brand lockup as a masthead, echoing the testimonial panel's corner
            mark — the numeral enters with it, as one composition. */}
        <div className="animate-in duration-700 ease-out fade-in-0 motion-reduce:animate-none">
          <span className="flex items-center justify-center gap-2">
            <Logo className="size-7" />
            <span className="text-lg font-medium tracking-tight">Antara</span>
          </span>
          <p
            aria-hidden
            className="mt-9 text-[clamp(5.5rem,19vw,10rem)] leading-[0.95] font-medium tracking-tighter text-foreground"
          >
            404
          </p>
        </div>

        {/* The copy follows one beat later; fill-mode-backwards holds the
            delayed group at its "from" state so it never flashes before its
            own animation begins. */}
        <div className="mt-7 flex max-w-sm animate-in flex-col items-center gap-2.5 delay-100 duration-500 ease-out fade-in-0 fill-mode-backwards slide-in-from-bottom-2 motion-reduce:animate-none sm:max-w-md sm:gap-3">
          <p className="text-2xl font-medium tracking-tighter text-balance sm:text-3xl">
            This page never made the final cut
          </p>
          <p className="text-sm tracking-tight text-balance text-muted-foreground sm:text-base">
            It may have been moved, renamed, or deleted. Everything else is
            right where you left it.
          </p>
        </div>

        <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link to="/dashboard">Back to your workspace</Link>
          </Button>
          {canGoBack && (
            <Button
              variant="ghost"
              size="lg"
              onClick={() => router.history.back()}
            >
              <ArrowLeftIcon />
              Go back
            </Button>
          )}
        </div>
      </div>
    </main>
  )
}
