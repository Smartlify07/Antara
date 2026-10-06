import { createFileRoute } from "@tanstack/react-router"
import { TeamMembers } from "@/components/team/team-members"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { listWorkspaceMembersFn } from "@/server/functions/workspaces"

export const Route = createFileRoute("/w/$workspaceSlug/team")({
  loader: ({ context }) =>
    listWorkspaceMembersFn({ data: { workspaceId: context.workspaceId } }),
  component: TeamPage,
})

function TeamPage() {
  const members = Route.useLoaderData()
  const { workspaceRole, isWorkspaceOwner } = Route.useRouteContext()
  const canManage = workspaceRole === "admin" || isWorkspaceOwner

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
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
            Invitations, suspensions, and role changes arrive next.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TeamMembers members={members} canManage={canManage} />
        </CardContent>
      </Card>
    </div>
  )
}
