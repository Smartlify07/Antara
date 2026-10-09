import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Clock, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { revokeInviteFn } from "@/server/functions/invites"
import {
  inviteKeys,
  pendingInvitesQuery,
  type PendingInviteRow,
} from "@/lib/queries/invites"

/**
 * Pending invites, shown to admins.
 *
 * Attribution appears only when the server sent it — `invitedByName` is
 * undefined for any caller who may not manage the workspace, because the
 * service omits the field rather than sending it for the UI to hide.
 */
export function PendingInvites({ workspaceSlug }: { workspaceSlug: string }) {
  const client = useQueryClient()

  const { data: invites = [], isPending } = useQuery(
    pendingInvitesQuery(workspaceSlug),
  )

  const revoke = useMutation({
    mutationFn: (inviteId: string) =>
      revokeInviteFn({ data: { workspaceSlug, inviteId } }),
    onSuccess: () => {
      void client.invalidateQueries({
        queryKey: inviteKeys.pending(workspaceSlug),
      })
    },
  })

  if (isPending || invites.length === 0) return null

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-medium tracking-tight">Pending invites</h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {invites.length}
        </span>
      </div>

      <div className="divide-y divide-border rounded-xl border">
        {invites.map((invite) => (
          <PendingInviteRow
            key={invite.id}
            invite={invite}
            revoking={
              revoke.isPending && revoke.variables === invite.id
            }
            onRevoke={() => revoke.mutate(invite.id)}
          />
        ))}
      </div>
    </section>
  )
}

function PendingInviteRow({
  invite,
  revoking,
  onRevoke,
}: {
  invite: PendingInviteRow
  revoking: boolean
  onRevoke: () => void
}) {
  const days = Math.max(
    0,
    Math.round((new Date(invite.expiresAt).getTime() - Date.now()) / 86_400_000),
  )

  return (
    <div className="flex items-center gap-3 p-3">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{invite.email}</span>
        <span className="truncate text-xs text-muted-foreground">
          {invite.role}
          {invite.invitedByName ? ` · invited by ${invite.invitedByName}` : ""}
        </span>
      </div>

      <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
        <Clock className="size-3.5" />
        {days === 0 ? "expires today" : `${days}d left`}
      </span>

      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Revoke invite for ${invite.email}`}
        disabled={revoking}
        onClick={onRevoke}
      >
        {revoking ? (
          <Loader2 className="animate-spin" />
        ) : (
          <X />
        )}
      </Button>
    </div>
  )
}