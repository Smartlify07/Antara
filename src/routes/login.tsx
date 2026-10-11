import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"
import { AuthLayout } from "@/components/auth/auth-layout"
import { LoginForm } from "@/components/auth/login-form"
import { useSession } from "@/lib/auth-client"
import { enterApp } from "@/lib/enter-app"
import { safeCallbackURL } from "@/lib/safe-callback-url"
import { authLandingFn, landingRedirect } from "@/server/functions/workspaces"

export const Route = createFileRoute("/login")({
  // Set when someone arrived from an invite, so signing in still completes it
  // for people who already had an account.
  validateSearch: (search: Record<string, unknown>) => ({
    callbackURL:
      typeof search.callbackURL === "string" ? search.callbackURL : undefined,
  }),
  // Redirects before the route renders, so someone who already has a session
  // never sees the form — not even for a frame. Previously this was an effect,
  // which meant rendering the form (or a spinner) and then navigating away.
  //
  // `beforeLoad` runs once per navigation, so it cannot observe a session
  // created *by* signing in on this page — that case is handled in the effect
  // below, which is also the only place `callbackURL` can be honoured for a
  // fresh sign-in, since by then beforeLoad is long done.
  beforeLoad: async ({ search }) => {
    const landing = await authLandingFn()
    if (!landing) return
    const target = safeCallbackURL(search.callbackURL)
    if (target) throw redirect({ to: target })
    throw redirect(landingRedirect(landing.slug))
  },
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
  const { callbackURL } = Route.useSearch()
  const { data } = useSession()
  const target = safeCallbackURL(callbackURL)

  // Signs-ins that happen on this page never re-run `beforeLoad`, so this is
  // the one path left to cover. The form is already on screen and this
  // navigates away from it — no pending state, nothing to flash.
  useEffect(() => {
    if (!data?.session) return
    if (target) {
      void navigate({ to: target, replace: true })
      return
    }
    void enterApp(navigate)
  }, [data?.session, navigate, target])

  return (
    <AuthLayout>
      <LoginForm />
    </AuthLayout>
  )
}
