import { Link, createFileRoute } from "@tanstack/react-router"
import { CircleCheck, MailWarning } from "lucide-react"
import { AuthLayout } from "@/components/auth/auth-layout"
import { AuthPending } from "@/components/auth/auth-pending"
import { ResendVerification } from "@/components/auth/resend-verification"
import { Button } from "@/components/ui/button"
import { useAuthStatus } from "@/lib/use-auth-status"
import { useSession } from "@/lib/auth-client"

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
 * The landing page the emailed link redirects to once its token is consumed.
 *
 * better-auth performs the verification itself and then redirects here, so
 * this page never sees a token. It receives either nothing at all (success)
 * or `?error=SLUG` (failure).
 *
 * That makes the bare URL ambiguous — it looks the same whether someone just
 * clicked a working link or typed the address in. So the state is resolved
 * from the *session*, not from the absence of a parameter: on success
 * better-auth has already set a cookie for a now-verified user, which
 * `useSession` reports as `emailVerified: true`. A bare visit from someone
 * unverified correctly falls through to the neutral state instead of claiming
 * a confirmation that never happened.
 */
function VerifyEmailPage() {
  const { error } = Route.useSearch()
  // Latched, because `useSession().isPending` also goes true on background
  // refetches — focusing the window mid-flow would otherwise bounce a
  // confirmed user back to a spinner.
  const status = useAuthStatus()
  const { data } = useSession()

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
            <ResendVerification />
          </>
        ) : status === "pending" ? (
          <AuthPending />
        ) : data?.user?.emailVerified ? (
          <>
            <Header
              icon={<CircleCheck className="size-10 text-primary" />}
              title="Email confirmed"
              body="Your address is verified and you're signed in. Pick up where you left off."
            />
            <Button asChild className="w-full">
              <Link to="/dashboard">Continue to Antara</Link>
            </Button>
          </>
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
