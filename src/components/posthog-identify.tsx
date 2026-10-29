import { useEffect, useRef } from "react"
import { useSession } from "@/lib/auth-client"
import { identifyUser, resetUser } from "@/lib/posthog"

/**
 * Keeps PostHog's person in step with the auth session.
 *
 * - A signed-in session identifies the user (id + email + name), merging their
 *   browser and server-side events onto a single PostHog person.
 * - Signing out resets the local identity so the next anonymous session does
 *   not inherit the previous user's events.
 *
 * Renders nothing. Mounted once in the root shell, where the session is
 * already available via better-auth's `useSession`.
 */
export function PostHogIdentify() {
  const { data, isPending } = useSession()
  const user = data?.user
  const lastId = useRef<string | null>(null)

  useEffect(() => {
    if (isPending) return
    const id = user?.id ?? null

    if (id && id !== lastId.current) {
      identifyUser(id, { email: user?.email, name: user?.name })
    } else if (!id && lastId.current) {
      resetUser()
    }

    lastId.current = id
  }, [isPending, user])

  return null
}
