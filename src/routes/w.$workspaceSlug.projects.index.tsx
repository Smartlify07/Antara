import { useMemo } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { AlertCircleIcon, PlusIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyOverview } from "@/components/workspace/empty-overview"
import { ProjectsGrid } from "@/components/workspace/projects-grid"
import { listProjectsFn } from "@/server/functions/projects"
import { useOptimisticProjects } from "@/lib/optimistic-projects"

export const Route = createFileRoute("/w/$workspaceSlug/projects/")({
  loader: ({ context }) =>
    listProjectsFn({ data: { workspaceId: context.workspaceId } }),
  component: ProjectsPage,
})

function ProjectsPage() {
  const loaded = Route.useLoaderData()
  const { projects: optimistic, error } = useOptimisticProjects()
  const { workspace, workspaceRole, isWorkspaceOwner, workspaceId } =
    Route.useRouteContext()

  const canManage = isWorkspaceOwner || workspaceRole === "admin"

  // Real rows win: once the server has the project the placeholder is
  // dropped by slug, so the swap happens without the card jumping. The
  // combined list is sorted with the same rule the service uses (soonest
  // deadline first, nulls last, then newest first) so an optimistic card
  // lands in its final position immediately instead of jumping on arrival.
  const merged = useMemo(() => {
    const realSlugs = new Set(loaded.map((project) => project.slug))
    return [
      ...loaded,
      ...optimistic.filter((p) => !realSlugs.has(p.slug)),
    ].sort((a, b) => {
      const aDue = a.deadline ? new Date(a.deadline).getTime() : Infinity
      const bDue = b.deadline ? new Date(b.deadline).getTime() : Infinity
      if (aDue !== bDue) return aDue - bDue
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }, [loaded, optimistic])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium tracking-tighter">Projects</h1>
          <p className="text-sm tracking-tight text-muted-foreground">
            {merged.length === 0
              ? "Briefs, tasks, and assets live here."
              : `${merged.length} ${merged.length === 1 ? "project" : "projects"} in this workspace.`}
          </p>
        </div>

        <Button asChild size="sm" className="shrink-0">
          <Link
            to="/w/$workspaceSlug/projects/new"
            params={{ workspaceSlug: workspace.slug }}
          >
            <PlusIcon />
            Create project
          </Link>
        </Button>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <AlertCircleIcon className="size-4 shrink-0" />
          {error}
        </div>
      )}

      {merged.length === 0 ? (
        <EmptyOverview
          workspaceTitle={workspace.title}
          workspaceSlug={workspace.slug}
        />
      ) : (
        <ProjectsGrid
          projects={merged}
          workspaceId={workspaceId}
          canManage={canManage}
        />
      )}
    </div>
  )
}
