import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect, useRef } from "react"
import { AuthLayout } from "@/components/auth/auth-layout"
import { AuthPending } from "@/components/auth/auth-pending"
import { LoginForm } from "@/components/auth/login-form"
import { navigateWithTransition } from "@/lib/navigate-with-transition"
import { useAuthStatus } from "@/lib/use-auth-status"

export const Route = createFileRoute("/login")({
  component: LoginPage,
})

/**
 * Owns *all* post-auth navigation. It used to be split between this route and
 * `LoginForm`, which both navigated on a successful sign-in: this page's
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
 * `arrivedSignedIn` records the first settled status and never changes, so it
 * can't flip once a sign-in lands mid-session.
 */
function LoginPage() {
  const status = useAuthStatus()
  const navigate = useNavigate()

  const arrivedSignedIn = useRef<boolean | null>(null)
  if (status !== "pending" && arrivedSignedIn.current === null) {
    arrivedSignedIn.current = status === "authenticated"
  }

  useEffect(() => {
    if (status !== "authenticated") return

    if (arrivedSignedIn.current) {
      void navigate({ to: "/dashboard", replace: true })
      return
    }

    void navigateWithTransition(() =>
      navigate({ to: "/dashboard", replace: true })
    )
  }, [status, navigate])

  return (
    <AuthLayout>
      {status === "pending" ? <AuthPending /> : <LoginForm />}
    </AuthLayout>
  )
}
