import { createFileRoute } from "@tanstack/react-router"
import { AppShell } from "@/components/app-shell"
import { TeamMembers } from "@/components/team/team-members"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  getWorkspaceFn,
  listWorkspaceMembersFn,
} from "@/server/functions/workspaces"

export const Route = createFileRoute("/w/$workspaceSlug/team")({
  loader: async ({ params }) => {
    const access = await getWorkspaceFn({
      data: { slug: params.workspaceSlug },
    })
    const members = await listWorkspaceMembersFn({
      data: { workspaceId: access.workspace.id },
    })
    return { access, members }
  },
  component: TeamPage,
})

function TeamPage() {
  const { access, members } = Route.useLoaderData()
  const { workspace, role, isOwner } = access
  const canManage = isOwner || role === "admin"

  return (
    <AppShell
      crumbs={[
        { label: workspace.title, href: `/w/${workspace.slug}` },
        { label: "Team" },
      ]}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div>
          <h1 className="text-2xl font-medium tracking-tighter">Team</h1>
          <p className="text-sm tracking-tight text-muted-foreground">
            {members.length} {members.length === 1 ? "member" : "members"} in
            this workspace.
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
    </AppShell>
  )
}
