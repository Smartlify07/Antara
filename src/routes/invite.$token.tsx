import { useQuery } from "@tanstack/react-query"
import { Link, createFileRoute, redirect } from "@tanstack/react-router"
import { MailWarning, ShieldQuestion } from "lucide-react"
import { AuthLayout } from "@/components/auth/auth-layout"
import { Button } from "@/components/ui/button"
import {
  acceptInviteFn,
  inspectInviteFn,
  inviteViewerFn,
} from "@/server/functions/invites"
import { queryOptions } from "@tanstack/react-query"

const viewerQuery = queryOptions({
  queryKey: ["invite", "viewer"] as const,
  queryFn: () => inviteViewerFn(),
})

export const Route = createFileRoute("/invite/$token")({
  // Resolved before render, so a dead invite never flashes a live-looking page.
  // A missing, expired and already-accepted token all resolve to `valid: false`
  // — the server deliberately doesn't distinguish them, because saying
  // "expired" would confirm a guessed token was once real.
  //
  // A caller who is *already verified* is accepted here and redirected on. No
  // confirmation button: they clicked a link to join a workspace, that is the
  // consent. Only the states a person has to act on get as far as rendering.
  //
  // Returning the invite from `beforeLoad` rather than re-fetching it in a
  // loader keeps this to a single inspection.
  beforeLoad: async ({ params }) => {
    const invite = await inspectInviteFn({ data: { token: params.token } })
    if (!invite.valid) return { invite }

    const viewer = await inviteViewerFn()
    if (!viewer.signedIn || !viewer.emailVerified) return { invite }

    const accepted = await acceptInviteFn({ data: { token: params.token } })
    if (accepted.ok) {
      // The workspace's own beforeLoad re-checks access, so an invite revoked
      // between this check and the redirect still can't be used to get in.
      throw redirect({
        to: "/w/$workspaceSlug/projects",
        params: { workspaceSlug: accepted.workspaceSlug },
      })
    }
    // Fell through — the invite died between the two calls. Fall through to
    // render, which shows the dead state.
    return { invite }
  },
  component: InvitePage,
})

function InvitePage() {
  const { token } = Route.useParams()
  const { invite: inspect } = Route.useRouteContext()

  if (!inspect.valid) return <DeadInvite />

  const { data: viewer } = useQuery(viewerQuery)

  // Signed out. The token rides along as `callbackURL` so signup or login
  // returns here rather than to the generic landing page — better-auth
  // validates it against trustedOrigins, and a root-relative path passes
  // without needing this origin listed.
  if (!viewer?.signedIn) {
    return (
      <AuthLayout>
        <div className="flex flex-col gap-6">
          <Header
            icon={<ShieldQuestion className="size-10 text-primary" />}
            title={`Join ${inspect.workspaceTitle}`}
            body={`You've been invited as ${lowerRole(
              inspect.roleTitle
            )}. Sign in or create an account to accept.`}
          />
          <Button asChild className="w-full">
            <Link to="/signup" search={{ callbackURL: `/invite/${token}` }}>
              Create an account
            </Link>
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              to="/login"
              search={{ callbackURL: `/invite/${token}` }}
              className="font-medium"
            >
              Log in
            </Link>
          </p>
        </div>
      </AuthLayout>
    )
  }

  // Signed in but unverified. Accepting requires a verified session, and
  // beforeLoad has already declined for exactly this reason.
  return (
    <AuthLayout>
      <div className="flex flex-col gap-6">
        <Header
          icon={<MailWarning className="size-10 text-destructive" />}
          title="Confirm your email first"
          body={`This invite was sent to ${maskEmail(
            inspect.emailHint
          )}. Confirm that address before accepting.`}
        />
        <Button asChild className="w-full">
          <Link to="/verify-email" search={{ error: undefined }}>
            Send a new link
          </Link>
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          <Link to="/dashboard" className="font-medium">
            Skip for now
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}

/**
 * Deliberately uniform. Saying "expired" versus "already used" would tell an
 * attacker that a token they guessed was once valid — and at 32 bytes of
 * entropy nothing is guessable anyway, so the distinction buys nothing.
 */
function DeadInvite() {
  return (
    <AuthLayout>
      <div className="flex flex-col gap-6">
        <Header
          icon={<MailWarning className="size-10 text-muted-foreground" />}
          title="This invite isn't valid"
          body="It may have expired, already been used, or been revoked. Ask whoever invited you to send another."
        />
        <Button asChild className="w-full">
          <Link to="/login" search={{ callbackURL: undefined }}>
            Go to log in
          </Link>
        </Button>
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

function lowerRole(title: string | null) {
  if (!title) return "a member"
  return title.charAt(0).toLowerCase() + title.slice(1)
}

/** Enough to confirm the address, not enough to be a harvested address. */
function maskEmail(email: string) {
  const [local, domain] = email.split("@")
  if (!domain) return email
  const head = local.slice(0, Math.min(2, local.length))
  return `${head}${"•".repeat(Math.max(2, local.length - 2))}@${domain}`
}
