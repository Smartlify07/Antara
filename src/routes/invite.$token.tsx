import { useMutation, useQuery } from "@tanstack/react-query"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { CircleCheck, Loader2, MailWarning, ShieldQuestion } from "lucide-react"
import { useState } from "react"
import { AuthLayout } from "@/components/auth/auth-layout"
import { Button } from "@/components/ui/button"
import { inviteViewerQuery } from "@/lib/queries/invites"
import {
  acceptInviteFn,
  declineInviteFn,
  inspectInviteFn,
} from "@/server/functions/invites"

export const Route = createFileRoute("/invite/$token")({
  // Resolved before render, so a dead invite never flashes a live-looking page.
  // A missing, expired and already-accepted token all resolve to `valid: false`
  // — the server deliberately doesn't distinguish them, because saying
  // "expired" would confirm a guessed token was once real.
  //
  // Deliberately does NOT accept here. It used to, on the reasoning that
  // clicking the link was consent — but consent to join a workspace is an
  // explicit choice, and the invitation stays pending until it's made.
  beforeLoad: async ({ params }) => {
    const invite = await inspectInviteFn({ data: { token: params.token } })
    return { invite }
  },
  component: InvitePage,
})

/**
 * The consent screen, shared by `/invite/$token` and `/invite/pending` so both
 * read identically.
 */
export function InviteDecision({
  workspaceTitle,
  roleTitle,
  onAccept,
  onDecline,
  pending,
  declined,
}: {
  workspaceTitle: string
  roleTitle: string | null
  onAccept: () => void
  onDecline: () => void
  pending: boolean
  declined: boolean
}) {
  const [gone, setGone] = useState(false)

  if (gone || declined) {
    return (
      <AuthLayout>
        <div className="flex flex-col gap-6">
          <Header
            icon={<MailWarning className="size-10 text-muted-foreground" />}
            title="Invitation declined"
            body={`You'll keep your ${workspaceTitle} account, but you won't have access to the workspace. You can ask for another invite any time.`}
          />
          <Button asChild className="w-full">
            <Link to="/dashboard">Go to your dashboard</Link>
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <div className="flex flex-col gap-6">
        <Header
          icon={<CircleCheck className="size-10 text-primary" />}
          title={`Join ${workspaceTitle}`}
          body={`You've been invited as ${lowerRole(roleTitle)}. Accept to get access, or decline to skip.`}
        />

        <div className="flex flex-col gap-2">
          <Button className="w-full" disabled={pending} onClick={onAccept}>
            {pending && <Loader2 className="animate-spin" />}
            {pending ? "Joining…" : "Accept invite"}
          </Button>
          <Button
            variant="outline"
            className="w-full"
            disabled={pending}
            onClick={() => {
              setGone(true)
              onDecline()
            }}
          >
            Not now
          </Button>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          The invite stays pending until you accept.
        </p>
      </div>
    </AuthLayout>
  )
}

function InvitePage() {
  const { token } = Route.useParams()
  const { invite: inspect } = Route.useRouteContext()
  const { data: viewer } = useQuery(inviteViewerQuery())
  const navigate = useNavigate()
  const [declined, setDeclined] = useState(false)

  const accept = useMutation({
    mutationFn: (t: string) => acceptInviteFn({ data: { token: t } }),
    onSuccess: (result) => {
      if (result.ok) {
        // Straight into the workspace. The workspace's own beforeLoad
        // re-checks access, so an invite revoked between the decision and the
        // redirect still can't be used to get in.
        void navigate({
          to: "/w/$workspaceSlug/projects",
          params: { workspaceSlug: result.workspaceSlug },
          replace: true,
        })
      }
    },
  })

  const decline = useMutation({
    mutationFn: (inviteId: string) => declineInviteFn({ data: { inviteId } }),
    onSuccess: () => setDeclined(true),
  })

  if (!inspect.valid) return <DeadInvite />

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

  if (!viewer.emailVerified) {
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
        </div>
      </AuthLayout>
    )
  }

  return (
    <InviteDecision
      workspaceTitle={inspect.workspaceTitle}
      roleTitle={inspect.roleTitle}
      pending={accept.isPending || decline.isPending}
      declined={declined}
      onAccept={() => accept.mutate(token)}
      onDecline={() => decline.mutate(inspect.valid ? inspect.inviteId : "")}
    />
  )
}

export { InviteDecision as InviteDecisionSurface }

/**
 * Deliberately uniform. Saying "expired" versus "already used" would tell an
 * attacker that a token they guessed was once real — and at 32 bytes of
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

export function Header({
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
