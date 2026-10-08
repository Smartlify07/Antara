import { Loader2 } from "lucide-react"

/**
 * Shown while the session query resolves for the first time.
 *
 * Rendered *inside* `AuthLayout` rather than replacing it. Returning early
 * with `null` blanks the whole page — logo, testimonial panel and all — so it
 * disappears and reappears on every load.
 */
export function AuthPending() {
  return (
    <div className="flex min-h-40 items-center justify-center">
      <Loader2 className="animate-spin text-muted-foreground" />
    </div>
  )
}
