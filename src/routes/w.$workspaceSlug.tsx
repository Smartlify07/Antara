import { Link, createFileRoute } from "@tanstack/react-router"
import { ArrowRightIcon, FolderKanbanIcon, UsersIcon } from "lucide-react"
import { AppShell } from "@/components/app-shell"
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

export const Route = createFileRoute("/w/$workspaceSlug")({
  loader: async ({ params }) => {
    const access = await getWorkspaceFn({
      data: { slug: params.workspaceSlug },
    })
    const members = await listWorkspaceMembersFn({
      data: { workspaceId: access.workspace.id },
    })
    return { access, memberCount: members.length }
  },
  component: WorkspaceHomePage,
})

function WorkspaceAvatar({
  name,
  avatarUrl,
}: {
  name: string
  avatarUrl: string | null
}) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={`${name} logo`}
        className="size-14 rounded-2xl object-cover ring-1 ring-black/10 ring-inset"
      />
    )
  }
  return (
    <span
      aria-hidden
      className="flex size-14 items-center justify-center rounded-2xl bg-primary text-xl font-medium text-primary-foreground"
    >
      {(name.trim()[0] ?? "W").toUpperCase()}
    </span>
  )
}

function WorkspaceHomePage() {
  const { access, memberCount } = Route.useLoaderData()
  const { workspace, role, isOwner } = access

  return (
    <AppShell crumbs={[{ label: workspace.title }]}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <Card>
          <CardHeader className="flex-row items-center gap-4 space-y-0">
            <WorkspaceAvatar
              name={workspace.title}
              avatarUrl={workspace.avatarUrl}
            />
            <div className="flex flex-1 flex-col gap-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-xl font-medium tracking-tight">
                  {workspace.title}
                </CardTitle>
                <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                  {isOwner ? "owner" : role}
                </span>
              </div>
              <CardDescription>/w/{workspace.slug}</CardDescription>
            </div>
          </CardHeader>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium tracking-tight">
                Projects
              </CardTitle>
              <CardDescription>
                Create projects to organize briefs, tasks, and assets.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <FolderKanbanIcon className="size-4" />
                Coming soon
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium tracking-tight">
                Team
              </CardTitle>
              <CardDescription>
                {memberCount} {memberCount === 1 ? "member" : "members"} in this
                workspace.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                to="/w/$workspaceSlug/team"
                params={{ workspaceSlug: workspace.slug }}
                className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary"
              >
                <UsersIcon className="size-4" />
                Manage team
                <ArrowRightIcon className="size-3.5" />
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  )
}
