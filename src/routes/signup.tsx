import { createFileRoute, redirect } from "@tanstack/react-router"
import { AuthLayout } from "@/components/auth/auth-layout"
import { SignupForm } from "@/components/auth/signup-form"
import { authLandingFn, landingRedirect } from "@/server/functions/workspaces"
import { safeCallbackURL } from "@/lib/safe-callback-url"

export const Route = createFileRoute("/signup")({
  // Set when someone arrived from an invite. Forwarded into `signUp.email`, so
  // the verification link returns them to the invite instead of the generic
  // verification page.
  validateSearch: (search: Record<string, unknown>) => ({
    callbackURL:
      typeof search.callbackURL === "string" ? search.callbackURL : undefined,
  }),
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
  const { callbackURL } = Route.useSearch()

  // No pending state and no client-side redirect: signup never creates a
  // session (verification gates it), and the Google button does a full-page
  // redirect via callbackURL rather than a client-side one. So the only way a
  // session can appear here is `beforeLoad`, which already handled it.
  return (
    <AuthLayout>
      <SignupForm callbackURL={safeCallbackURL(callbackURL)} />
    </AuthLayout>
  )
}
