import { Link, createFileRoute } from "@tanstack/react-router"
import { TriangleAlert } from "lucide-react"
import { AuthLayout } from "@/components/auth/auth-layout"

/**
 * Where a failed OAuth sign-in lands.
 *
 * better-auth redirects social-auth failures to `${baseURL}/error?error=<code>`
 * (its `defaultErrorURL`) rather than to the success `callbackURL`, so a broken
 * Google handshake — a mismatched account link, a cancelled consent screen — has
 * somewhere honest to explain itself instead of dead-ending on the 404 this
 * route used to be.
 *
 * The slugs are better-auth's `OAUTH_CALLBACK_ERROR_CODES`; only the two a real
 * user can reach are given specific copy, and everything else falls through to
 * the generic message rather than leaking which step failed.
 */

const ERROR_COPY: Record<string, { title: string; body: string }> = {
  unable_to_link_account: {
    title: "We couldn't sign you in",
    body: "There's already an Antara account for that email, but it isn't linked to Google. Log in with your email and password instead.",
  },
  account_already_linked_to_different_user: {
    title: "That Google account is already in use",
    body: "It's linked to a different Antara account. Log in with that account's email, or use another Google account.",
  },
  email_not_verified: {
    title: "That email isn't verified",
    body: "Sign in with your email and password and verify the address first.",
  },
}

const GENERIC_ERROR = {
  title: "Sign-in didn't go through",
  body: "Your sign-in was interrupted. Please try again.",
}

export const Route = createFileRoute("/error")({
  validateSearch: (search: Record<string, unknown>) => ({
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  component: ErrorPage,
})

function ErrorPage() {
  const { error } = Route.useSearch()
  const copy = error ? (ERROR_COPY[error] ?? GENERIC_ERROR) : GENERIC_ERROR

  return (
    <AuthLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <TriangleAlert className="size-10 text-destructive" />
          <h1 className="font-sans text-2xl font-medium tracking-tighter">
            {copy.title}
          </h1>
          <p className="text-sm tracking-tight text-balance text-muted-foreground">
            {copy.body}
          </p>
        </div>

        <div className="flex flex-col items-center gap-2">
          <Link
            to="/login"
            search={{ callbackURL: undefined }}
            className="text-sm font-medium hover:underline"
          >
            Back to log in
          </Link>
        </div>
      </div>
    </AuthLayout>
  )
}
