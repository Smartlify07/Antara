import { Link, createFileRoute, redirect } from "@tanstack/react-router"
import { MailWarning } from "lucide-react"
import { useEffect, useState } from "react"
import { AuthLayout } from "@/components/auth/auth-layout"
import { ResendVerification } from "@/components/auth/resend-verification"
import { readPendingVerification } from "@/lib/pending-verification"
import { authLandingFn, landingRedirect } from "@/server/functions/workspaces"

export const Route = createFileRoute("/verify-email")({
  validateSearch: (search: Record<string, unknown>) => ({
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  // Clicking a working link never renders this route. better-auth has already
  // consumed the token and set the session cookie by the time we're asked, so
  // a confirmed visitor is redirected straight into the app — the page is a
  // dead link handler and a bare-visit landing, nothing more.
  beforeLoad: async () => {
    const landing = await authLandingFn()
    if (!landing?.emailVerified) return
    throw redirect(landingRedirect(landing.slug))
  },
  component: VerifyEmailPage,
})

/**
 * Copy for the error slugs better-auth redirects with. Anything not listed
 * here — including `USER_NOT_FOUND` and `INVALID_USER` — falls through to
 * the generic entry. Reaching those requires a correctly-signed token, so
 * there is nothing to gain from telling them apart.
 */
const ERROR_COPY: Record<string, { title: string; body: string }> = {
  TOKEN_EXPIRED: {
    title: "That link has expired",
    body: "Verification links are valid for 48 hours. Send yourself a fresh one below.",
  },
  INVALID_TOKEN: {
    title: "That link isn't valid",
    body: "It may have been altered in transit. Send yourself a fresh link below.",
  },
}

const GENERIC_ERROR = {
  title: "We couldn't confirm that link",
  body: "Send yourself a fresh verification link below.",
}

/**
 * Where a dead verification link lands.
 *
 * better-auth consumes the token itself and redirects here, so this page never
 * sees one. It receives either nothing at all (success) or `?error=SLUG`. The
 * success branch no longer arrives — `beforeLoad` redirects confirmed visitors
 * before this renders — so what remains is the explanation for a link that
 * didn't work.
 *
 * `callbackURL` can't just be the workspace, by the way. It's a single value
 * used for *both* outcomes, so failures would land somewhere the loader
 * bounces an unauthenticated visitor to /login, and the error would be
 * swallowed. Keeping the redirect here is what lets a dead link say why.
 */
function VerifyEmailPage() {
  const { error } = Route.useSearch()

  // Read after mount: the route is server-rendered, so touching localStorage
  // during render would mismatch on hydration.
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)
  useEffect(() => {
    setPendingEmail(readPendingVerification())
  }, [])

  const errorCopy = error ? (ERROR_COPY[error] ?? GENERIC_ERROR) : null

  return (
    <AuthLayout>
      <div className="flex flex-col gap-6">
        {errorCopy ? (
          <>
            <Header
              icon={<MailWarning className="size-10 text-destructive" />}
              title={errorCopy.title}
              body={errorCopy.body}
            />
            <ResendVerification
              defaultEmail={pendingEmail ?? ""}
              hideInput={!!pendingEmail}
            />
          </>
        ) : (
          <>
            <Header
              icon={<MailWarning className="size-10 text-muted-foreground" />}
              title="Check your inbox"
              body="If that address needs verifying, we've sent it a link. Open it to finish setting up your account."
            />
            <ResendVerification
              defaultEmail={pendingEmail ?? ""}
              hideInput={!!pendingEmail}
            />
          </>
        )}

        <p className="text-sm tracking-tight text-balance text-muted-foreground">
          Already verified?{" "}
          <Link to="/login" className="font-medium">
            Log in
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}

function Header({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode
  title: string
  body: string
}) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      {icon}
      <h1 className="font-sans text-2xl font-medium tracking-tighter">
        {title}
      </h1>
      <p className="text-sm tracking-tight text-balance text-muted-foreground">
        {body}
      </p>
    </div>
  )
}
