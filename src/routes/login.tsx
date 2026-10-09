import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"
import { AuthLayout } from "@/components/auth/auth-layout"
import { LoginForm } from "@/components/auth/login-form"
import { useSession } from "@/lib/auth-client"
import { enterApp } from "@/lib/enter-app"
import { authLandingFn, landingRedirect } from "@/server/functions/workspaces"

export const Route = createFileRoute("/login")({
  // Redirects before the route renders, so someone who already has a session
  // never sees the form — not even for a frame. Previously this was an effect,
  // which meant rendering the form (or a spinner) and then navigating away.
  //
  // `beforeLoad` runs once per navigation, so it cannot observe a session
  // created *by* signing in on this page. That one case is handled in the
  // component below.
  beforeLoad: async () => {
    const landing = await authLandingFn()
    if (!landing) return
    throw redirect(landingRedirect(landing.slug))
  },
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
  const { data } = useSession()

  // Signs-in that happen on this page never re-run `beforeLoad`, so this is
  // the one path left to cover. The form is already on screen and this
  // navigates away from it — no pending state, nothing to flash.
  useEffect(() => {
    if (!data?.session) return
    void enterApp(navigate)
  }, [data?.session, navigate])

  return (
    <AuthLayout>
      <LoginForm />
    </AuthLayout>
  )
}
