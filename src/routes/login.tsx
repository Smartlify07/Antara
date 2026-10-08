import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Loader2 } from "lucide-react"
import { useEffect, useRef } from "react"
import { AuthLayout } from "@/components/auth/auth-layout"
import { LoginForm } from "@/components/auth/login-form"
import { useSession } from "@/lib/auth-client"
import { navigateWithTransition } from "@/lib/navigate-with-transition"

export const Route = createFileRoute("/login")({
  component: LoginPage,
})

/**
 * Owns *all* post-auth navigation. It used to be split between this route
 * and `LoginForm`, which both navigated on a successful sign-in: this page's
 * `<Navigate>` fired the instant the session atom updated, racing the
 * `navigateWithTransition` call in the form. Whichever lost, one of the two
 * navigations was untransitioned, so the hand-off to /dashboard jumped
 * instead of animating.
 *
 * Two cases, deliberately different:
 *
 * - Arrived here already signed in — nothing to animate from, go straight
 *   there.
 * - Just signed in on this page — animate it.
 *
 * `arrivedAuthenticated` is recorded on the first settled render and never
 * updated, so it can't flip once a sign-in lands mid-session.
 */
function LoginPage() {
  const { data, isPending } = useSession()
  const navigate = useNavigate()

  const arrivedAuthenticated = useRef<boolean | null>(null)
  if (!isPending && arrivedAuthenticated.current === null) {
    arrivedAuthenticated.current = Boolean(data?.session)
  }

  const hasSession = Boolean(data?.session)

  useEffect(() => {
    if (isPending || !hasSession) return

    if (arrivedAuthenticated.current) {
      void navigate({ to: "/dashboard", replace: true })
      return
    }

    void navigateWithTransition(() =>
      navigate({ to: "/dashboard", replace: true })
    )
  }, [hasSession, isPending, navigate])

  return (
    <AuthLayout>
      {/* Render the shell rather than `null` while the session resolves.
          Returning null blanks the whole page, so the chrome disappears and
          reappears — a visible flash before anything has happened. */}
      {isPending ? (
        <div className="flex min-h-40 items-center justify-center">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      ) : (
        <LoginForm />
      )}
    </AuthLayout>
  )
}
