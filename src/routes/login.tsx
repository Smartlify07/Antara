import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"
import { AuthLayout } from "@/components/auth/auth-layout"
import { AuthPending } from "@/components/auth/auth-pending"
import { LoginForm } from "@/components/auth/login-form"
import { enterApp } from "@/lib/enter-app"
import { useAuthStatus } from "@/lib/use-auth-status"

export const Route = createFileRoute("/login")({
  component: LoginPage,
})

/**
 * Owns *all* post-auth navigation. It used to be split between this route and
 * `LoginForm`, which both navigated on a successful sign-in: this page's
 * `<Navigate>` fired the instant the session atom updated, racing the
 * navigation in the form. Whichever lost, one of the two was untransitioned, so
 * the hand-off jumped instead of animating.
 *
 * `LoginForm` no longer navigates — the session atom updating is the trigger,
 * and this route is the only thing that reacts to it.
 */
function LoginPage() {
  const status = useAuthStatus()
  const navigate = useNavigate()

  useEffect(() => {
    if (status !== "authenticated") return
    void enterApp(navigate)
  }, [status, navigate])

  return (
    <AuthLayout>
      {status === "pending" ? <AuthPending /> : <LoginForm />}
    </AuthLayout>
  )
}
