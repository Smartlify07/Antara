import { useEffect, useState } from "react"
import { useSession } from "@/lib/auth-client"

export type AuthStatus = "pending" | "anonymous" | "authenticated"

/**
 * Session status where `pending` applies only *before* the first settled
 * answer, never again.
 *
 * `useSession().isPending` cannot be used as a render gate on its own.
 * better-auth recomputes it as `data === null` on every session fetch
 * (session-atom.mjs:60) rather than only the first, and it refetches on
 * window focus and visibility change by default (session-refresh.mjs:13,33).
 *
 * That matters most when there is no session, which is exactly the state
 * every visitor is in right after signing up: verification gates the session,
 * so `data` stays null. Focusing the window mid-flow flips `isPending` back
 * to true, a route gated on it swaps its children for a spinner, and when the
 * fetch settles the children are *remounted* — which discards their state.
 * That is what turned a completed signup back into an empty form.
 *
 * Latching on the first settled result means a route that has already resolved
 * never un-resolves, so whatever it rendered stays mounted.
 */
export function useAuthStatus(): AuthStatus {
  const { data, isPending } = useSession()
  const [settled, setSettled] = useState(false)

  useEffect(() => {
    if (!isPending) setSettled(true)
  }, [isPending])

  if (!settled) return "pending"
  return data?.session ? "authenticated" : "anonymous"
}
