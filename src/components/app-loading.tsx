import { Logo } from "@/components/logo"
import { cn } from "@/lib/utils"

/**
 * Linear-style pending view. The shell — sidebar and top bar — is already on
 * screen, so a fetching page never needs to prove itself with spinners or
 * partially rendered sections: its content area holds one logo that fades
 * most of the way in and back down until every query the page needs has
 * landed, and the page then pops in complete.
 *
 * As a page's root (under the shell's flex column) `flex-1` stretches it to
 * the full content area, so the logo sits dead centre. Nested usages keep
 * the `min-h-40` floor only.
 */
export function AppLoading({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        "flex min-h-40 flex-1 items-center justify-center",
        className
      )}
    >
      <Logo className="animate-logo-pulse size-10 text-primary" />
    </div>
  )
}
