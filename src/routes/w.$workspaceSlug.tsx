import { Link, createFileRoute } from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react"
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
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/w/$workspaceSlug")({
  loader: async ({ params }) => {
    const access = await getWorkspaceFn({
      data: { slug: params.workspaceSlug },
    })
    const members = await listWorkspaceMembersFn({
      data: { workspaceId: access.workspace.id },
    })
    return { access, members }
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
  const { access, members } = Route.useLoaderData()
  const { workspace, role, isOwner } = access

  return (
    <main className="min-h-svh bg-muted/40 p-4 sm:p-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <Link
          to="/dashboard"
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          All workspaces
        </Link>

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

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium tracking-tight">
              Getting started
            </CardTitle>
            <CardDescription>
              Projects and team invites arrive in the next milestones.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p className="text-muted-foreground">
              Create your first project to start assigning tasks and uploading
              assets.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium tracking-tight">
              Members ({members.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {members.map((member) => (
              <div key={member.id} className="flex items-center gap-3">
                <span
                  aria-hidden
                  className={cn(
                    "flex size-9 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground",
                    member.status === "suspended" && "opacity-50"
                  )}
                >
                  {(
                    member.name?.trim()[0] ??
                    member.email?.[0] ??
                    "?"
                  ).toUpperCase()}
                </span>
                <div className="flex flex-1 flex-col">
                  <span className="text-sm font-medium">
                    {member.name ?? member.email}
                  </span>
                  {member.name && (
                    <span className="text-xs text-muted-foreground">
                      {member.email ?? "Invited — no account yet"}
                    </span>
                  )}
                </div>
                <span className="rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {member.isOwner ? "owner" : member.role}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
