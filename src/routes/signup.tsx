import { createFileRoute, redirect } from "@tanstack/react-router"
import { AuthLayout } from "@/components/auth/auth-layout"
import { SignupForm } from "@/components/auth/signup-form"
import { authLandingFn, landingRedirect } from "@/server/functions/workspaces"

export const Route = createFileRoute("/signup")({
  // Signed-in visitors are turned away before the form renders. The old
  // version rendered the form (or a spinner) and redirected from an effect.
  beforeLoad: async () => {
    const landing = await authLandingFn()
    if (!landing) return
    throw redirect(landingRedirect(landing.slug))
  },
  component: SignupPage,
})

function SignupPage() {
  // No pending state and no client-side redirect: signup never creates a
  // session (verification gates it), and the Google button does a full-page
  // redirect via callbackURL rather than a client-side one. So the only way a
  // session can appear here is `beforeLoad`, which already handled it.
  return (
    <AuthLayout>
      <SignupForm />
    </AuthLayout>
  )
}
