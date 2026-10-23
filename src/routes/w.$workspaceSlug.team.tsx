import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { AppLoading } from "@/components/app-loading"
import { InviteDialog } from "@/components/team/invite-dialog"
import { TeamMembers } from "@/components/team/team-members"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { revokeInviteFn } from "@/server/functions/invites"
import { teamKeys, teamMembersQuery } from "@/lib/queries/teams"
import { workspaceKeys } from "@/lib/queries/workspaces"

export const Route = createFileRoute("/w/$workspaceSlug/team")({
  component: TeamPage,
})

function TeamPage() {
  const { workspace, workspaceId, workspaceRole, isWorkspaceOwner } =
    Route.useRouteContext()

  // Cached under a key, so the invite mutations can invalidate this list
  // without `router.invalidate()` refetching unrelated loaders across the app.
  const {
    data: members = [],
    isPending,
    error,
  } = useQuery(teamMembersQuery(workspaceId))

  const client = useQueryClient()

  const revoke = useMutation({
    mutationFn: (inviteId: string) =>
      revokeInviteFn({ data: { workspaceSlug: workspace.slug, inviteId } }),
    onSuccess: () => {
      // Revoking removes the seat as well as the invite, so the badge that
      // counts those seats has to drop too.
      void Promise.all([
        client.invalidateQueries({ queryKey: teamKeys.members(workspaceId) }),
        client.invalidateQueries({
          queryKey: workspaceKeys.teamCount(workspace.slug),
        }),
      ])
    },
  })

  const canManage = workspaceRole === "admin" || isWorkspaceOwner

  // One arrival: the header's count is the same fact the roster states, so
  // the page paints once, complete — the shell's pulsing logo covers the
  // fetch instead of a line inside the card.
  if (isPending) return <AppLoading />

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-medium tracking-tighter">Team</h1>
        <p className="text-sm tracking-tight text-muted-foreground">
          {members.length} {members.length === 1 ? "member" : "members"} in this
          workspace.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium tracking-tight">
            Members
          </CardTitle>
          <CardDescription>
            {canManage
              ? "Everyone here can see this workspace's projects. Suspending and removing people is coming next."
              : "Invitations, suspensions, and role changes are coming next."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error instanceof Error
                ? error.message
                : "Could not load members."}
            </p>
          ) : (
            <TeamMembers
              members={members}
              canManage={canManage}
              onRevokeInvite={(inviteId) => revoke.mutate(inviteId)}
              action={
                canManage ? (
                  <InviteDialog
                    workspaceSlug={workspace.slug}
                    workspaceId={workspaceId}
                  />
                ) : null
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
