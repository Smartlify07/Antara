import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { MailWarning } from "lucide-react"
import { useEffect } from "react"
import { AuthLayout } from "@/components/auth/auth-layout"
import { AuthPending } from "@/components/auth/auth-pending"
import { ResendVerification } from "@/components/auth/resend-verification"
import { useSession } from "@/lib/auth-client"
import { navigateWithTransition } from "@/lib/navigate-with-transition"
import { useAuthStatus } from "@/lib/use-auth-status"

export const Route = createFileRoute("/verify-email")({
  validateSearch: (search: Record<string, unknown>) => ({
    error: typeof search.error === "string" ? search.error : undefined,
  }),
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
 * The page the emailed link redirects to once its token is consumed.
 *
 * better-auth performs the verification itself and then redirects here, so
 * this page never sees a token. It receives either nothing at all (success)
 * or `?error=SLUG` (failure).
 *
 * This route exists only for the failure branch. On success it continues
 * straight to /dashboard instead of rendering anything — a link that already
 * did the thing doesn't need a page confirming it did. The redirect is a
 * second 302, so nobody perceives this route at all.
 *
 * `callbackURL` can't just be /dashboard, by the way. It's a single value used
 * for *both* outcomes, so failures would land on /dashboard?error=TOKEN_EXPIRED,
 * where the loader bounces an unauthenticated visitor to /login and the error
 * disappears. Keeping the redirect here is what lets a dead link explain itself.
 *
 * The bare URL is ambiguous — identical whether someone just clicked a working
 * link or typed the address in — so success is resolved from the session rather
 * than the absence of a parameter. better-auth has already set a cookie for a
 * now-verified user by the time we're asked.
 */
function VerifyEmailPage() {
  const { error } = Route.useSearch()
  // Latched, because `useSession().isPending` also goes true on background
  // refetches — focusing the window mid-flow would otherwise bounce a
  // confirmed user back to a spinner.
  const status = useAuthStatus()
  const { data } = useSession()
  const navigate = useNavigate()

  const errorCopy = error ? (ERROR_COPY[error] ?? GENERIC_ERROR) : null
  const verified =
    status === "authenticated" && data?.user?.emailVerified === true

  useEffect(() => {
    if (!verified) return
    void navigateWithTransition(() =>
      navigate({ to: "/dashboard", replace: true })
    )
  }, [verified, navigate])

  // Spinner while the session resolves, and again for the moment it takes to
  // hand off to the app on success.
  const settling = status === "pending" || verified

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
            <ResendVerification />
          </>
        ) : settling ? (
          <AuthPending />
        ) : (
          <>
            <Header
              icon={<MailWarning className="size-10 text-muted-foreground" />}
              title="Check your inbox"
              body="If that address needs verifying, we've sent it a link. Open it to finish setting up your account."
            />
            <ResendVerification />
          </>
        )}

        {!settling && (
          <p className="text-sm tracking-tight text-balance text-muted-foreground">
            Already verified?{" "}
            <Link to="/login" className="font-medium">
              Log in
            </Link>
          </p>
        )}
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
