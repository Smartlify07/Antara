import {
  Link,
  Navigate,
  createFileRoute,
  useNavigate,
} from "@tanstack/react-router"
import { Loader2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { authClient, useSession } from "@/lib/auth-client"
import { listWorkspacesFn } from "@/server/functions/workspaces"

export const Route = createFileRoute("/dashboard")({
  loader: async () => listWorkspacesFn(),
  component: DashboardPage,
})

function DashboardPage() {
  const { data, isPending } = useSession()
  const workspaces = Route.useLoaderData()
  const navigate = useNavigate()

  if (isPending) {
    return (
      <main className="flex min-h-svh items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground" />
      </main>
    )
  }

  if (!data?.session) return <Navigate to="/login" />

  async function handleSignOut() {
    await authClient.signOut()
    await navigate({ to: "/login" })
  }

  return (
    <main className="min-h-svh bg-muted/40 p-4 sm:p-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-medium tracking-tighter">
              Welcome, {data.user.name.split(" ")[0]}
            </h1>
            <p className="text-sm tracking-tight text-muted-foreground">
              Pick a workspace to get to work.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            Sign out
          </Button>
        </div>

        {workspaces.length === 0 ? (
          <Card className="items-center py-12 text-center">
            <CardHeader className="items-center">
              <CardTitle className="text-lg font-medium tracking-tight">
                No workspaces yet
              </CardTitle>
              <CardDescription>
                Create one to start managing projects, tasks, and assets.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link to="/workspaces/new">
                  <Plus />
                  Create workspace
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {workspaces.map((item) => (
              <Link
                key={item.workspace.id}
                to="/w/$workspaceSlug"
                params={{ workspaceSlug: item.workspace.slug }}
                className="block"
              >
                <Card className="h-full transition-colors hover:border-foreground/20">
                  <CardHeader className="flex-row items-center gap-3 space-y-0">
                    {item.workspace.avatarUrl ? (
                      <img
                        src={item.workspace.avatarUrl}
                        alt=""
                        className="size-11 rounded-xl object-cover ring-1 ring-black/10 ring-inset"
                      />
                    ) : (
                      <span
                        aria-hidden
                        className="flex size-11 items-center justify-center rounded-xl bg-primary text-base font-medium text-primary-foreground"
                      >
                        {(item.workspace.title.trim()[0] ?? "W").toUpperCase()}
                      </span>
                    )}
                    <div className="flex flex-col gap-0.5">
                      <CardTitle className="text-base font-medium tracking-tight">
                        {item.workspace.title}
                      </CardTitle>
                      <CardDescription>
                        /w/{item.workspace.slug} ·{" "}
                        {item.isOwner ? "owner" : item.role}
                      </CardDescription>
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            ))}
            <Link to="/workspaces/new" className="block">
              <Card className="h-full border-dashed transition-colors hover:border-foreground/20">
                <CardContent className="flex h-full min-h-24 items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Plus className="size-4" />
                  New workspace
                </CardContent>
              </Card>
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}
