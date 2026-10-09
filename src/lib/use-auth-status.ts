import { useState } from "react"
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
 * The latch is set during render rather than in an effect. An effect always
 * runs a tick after mount, which painted a spinner for a frame even when the
 * session was already known — the common case when arriving directly at
 * /login. Adjusting state during render re-renders before painting, so a
 * resolved status is available on the very first frame.
 */
export function useAuthStatus(): AuthStatus {
  const { data, isPending } = useSession()
  const [status, setStatus] = useState<AuthStatus | null>(() =>
    isPending ? null : data?.session ? "authenticated" : "anonymous"
  )

  if (status === null && !isPending) {
    setStatus(data?.session ? "authenticated" : "anonymous")
  }

  return status ?? "pending"
}
