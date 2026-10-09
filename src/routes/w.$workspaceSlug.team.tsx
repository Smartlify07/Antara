import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { InviteDialog } from "@/components/team/invite-dialog"
import { PendingInvites } from "@/components/team/pending-invites"
import { TeamMembers } from "@/components/team/team-members"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { teamMembersQuery } from "@/lib/queries/teams"

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

  const canManage = workspaceRole === "admin" || isWorkspaceOwner

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
              ? "Invite people, and manage who can see this workspace."
              : "Invitations, suspensions, and role changes arrive next."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <p className="text-sm text-muted-foreground">Loading members…</p>
          ) : error ? (
            <p role="alert" className="text-sm text-destructive">
              {error instanceof Error
                ? error.message
                : "Could not load members."}
            </p>
          ) : (
            <TeamMembers
              members={members}
              canManage={canManage}
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

      {canManage && <PendingInvites workspaceSlug={workspace.slug} />}
    </div>
  )
}
