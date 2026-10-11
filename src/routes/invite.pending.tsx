import { useMutation, useQuery } from "@tanstack/react-query"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { MailWarning, ShieldQuestion } from "lucide-react"
import { useState } from "react"
import { AuthLayout } from "@/components/auth/auth-layout"
import { Button } from "@/components/ui/button"
import { pendingInvitesQuery } from "@/lib/queries/invites"
import { Header, InviteDecision } from "./invite.$token"
import {
  acceptPendingInviteFn,
  declineInviteFn,
} from "@/server/functions/invites"

/**
 * Where someone lands when the invite *token* is gone.
 *
 * A resent verification email points at `/verify-email`. A link opened in a new
 * tab, or on another device, never carried one. Neither can be rebuilt — only
 * the token's hash is stored, deliberately.
 *
 * What survives all of that is the pending seat: once the signup backfill has
 * run it reads `{ user_id: <them>, joined_at: null }`, which says who has an
 * unaccepted invitation and for which workspace, with no token at all. So this
 * route finds them by that, and offers the same Accept / Not now choice a link
 * would have.
 */
export const Route = createFileRoute("/invite/pending")({
  component: PendingInvitesPage,
})

interface Pending {
  inviteId: string
  workspaceSlug: string
  workspaceTitle: string
  roleTitle: string
  expiresAt: Date | string
}

function PendingInvitesPage() {
  const { data: invites, isPending, error } = useQuery(pendingInvitesQuery())

  if (isPending) {
    return (
      <AuthLayout>
        <div className="flex min-h-40 items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </AuthLayout>
    )
  }

  if (error) {
    return (
      <AuthLayout>
        <div className="flex flex-col gap-6">
          <Header
            icon={<ShieldQuestion className="size-10 text-primary" />}
            title="Sign in to continue"
            body="We couldn't check your invitations right now. Try again in a moment."
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

  if (!invites?.length) {
    return (
      <AuthLayout>
        <div className="flex flex-col gap-6">
          <Header
            icon={<MailWarning className="size-10 text-muted-foreground" />}
            title="No invitations waiting"
            body="There's nothing pending on your account. If someone invited you, ask them to send another."
          />
          <Button asChild className="w-full">
            <Link to="/dashboard">Go to your dashboard</Link>
          </Button>
        </div>
      </AuthLayout>
    )
  }

  // Invited to more than one workspace: each is accepted separately, and
  // accepting one leaves the others pending.
  if (invites.length > 1) return <ManyInvites invites={invites} />

  return <OneInvite invite={invites[0]} />
}

function OneInvite({ invite }: { invite: Pending }) {
  const navigate = useNavigate()
  const [declined, setDeclined] = useState(false)

  const accept = useMutation({
    mutationFn: () =>
      acceptPendingInviteFn({ data: { inviteId: invite.inviteId } }),
    onSuccess: (result) => {
      if (result.ok) {
        void navigate({
          to: "/w/$workspaceSlug/projects",
          params: { workspaceSlug: result.workspaceSlug },
          replace: true,
        })
      }
    },
  })

  const decline = useMutation({
    mutationFn: () => declineInviteFn({ data: { inviteId: invite.inviteId } }),
    onSuccess: () => setDeclined(true),
  })

  return (
    <InviteDecision
      workspaceTitle={invite.workspaceTitle}
      roleTitle={invite.roleTitle}
      pending={accept.isPending || decline.isPending}
      declined={declined}
      onAccept={() => accept.mutate()}
      onDecline={() => decline.mutate()}
    />
  )
}

function ManyInvites({ invites }: { invites: Pending[] }) {
  const [declined, setDeclined] = useState<string[]>([])
  const [accepted, setAccepted] = useState<string[]>([])

  const accept = useMutation({
    mutationFn: (inviteId: string) =>
      acceptPendingInviteFn({ data: { inviteId } }),
    onSuccess: (_, inviteId) =>
      setAccepted((prev) =>
        prev.includes(inviteId) ? prev : [...prev, inviteId]
      ),
  })

  const decline = useMutation({
    mutationFn: (inviteId: string) => declineInviteFn({ data: { inviteId } }),
    onSuccess: (_, inviteId) =>
      setDeclined((prev) =>
        prev.includes(inviteId) ? prev : [...prev, inviteId]
      ),
  })

  const busy = accept.isPending || decline.isPending
  const remaining = invites.filter(
    (i) => !declined.includes(i.inviteId) && !accepted.includes(i.inviteId)
  )

  return (
    <AuthLayout>
      <div className="flex flex-col gap-6">
        <Header
          icon={<ShieldQuestion className="size-10 text-primary" />}
          title={`${remaining.length} pending ${
            remaining.length === 1 ? "invitation" : "invitations"
          }`}
          body="You've been invited to more than one workspace. Accept them one at a time — accepting one leaves the rest pending."
        />

        <div className="flex flex-col gap-2">
          {remaining.map((invite) => (
            <div
              key={invite.inviteId}
              className="flex items-center gap-2 rounded-lg border p-3"
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">
                  {invite.workspaceTitle}
                </span>
                <span className="text-xs text-muted-foreground">
                  as {invite.roleTitle.toLowerCase()}
                </span>
              </div>
              <Button
                size="sm"
                disabled={busy}
                onClick={() => accept.mutate(invite.inviteId)}
              >
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => decline.mutate(invite.inviteId)}
              >
                Not now
              </Button>
            </div>
          ))}
        </div>

        {remaining.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">
            Done — you can manage your workspaces from your dashboard.
          </p>
        )}

        <Button
          asChild
          className="w-full"
          variant={remaining.length ? "outline" : "default"}
        >
          <Link to="/dashboard">Go to your dashboard</Link>
        </Button>
      </div>
    </AuthLayout>
  )
}
