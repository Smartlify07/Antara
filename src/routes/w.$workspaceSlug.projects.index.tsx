import { useQuery } from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"
import { AlertCircleIcon, PlusIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyOverview } from "@/components/workspace/empty-overview"
import { ProjectsGrid } from "@/components/workspace/projects-grid"
import { projectsQuery } from "@/lib/queries/projects"

export const Route = createFileRoute("/w/$workspaceSlug/projects/")({
  component: ProjectsPage,
})

/**
 * The list comes from react-query rather than a route loader, so mutations can
 * patch the cache in place and invalidate precisely this query. Creating a
 * project used to call `router.invalidate()`, which refetched every active
 * loader in the app.
 *
 * There is no longer any optimistic bookkeeping here. The mutation writes a
 * placeholder straight into the cache and rolls back on failure, so the list
 * this renders is always the cache — there is nothing to reconcile.
 */
function ProjectsPage() {
  const { workspace, workspaceRole, isWorkspaceOwner, workspaceId } =
    Route.useRouteContext()

  const { data: projects = [], isPending, error } = useQuery(
    projectsQuery(workspaceId),
  )

  const canManage = isWorkspaceOwner || workspaceRole === "admin"

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium tracking-tighter">Projects</h1>
          <p className="text-sm tracking-tight text-muted-foreground">
            {projects.length === 0
              ? "Briefs, tasks, and assets live here."
              : `${projects.length} ${projects.length === 1 ? "project" : "projects"} in this workspace.`}
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
          {error instanceof Error ? error.message : "Could not load projects."}
        </div>
      )}

      {isPending ? (
        <div className="flex min-h-40 items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading projects…</p>
        </div>
      ) : projects.length === 0 ? (
        <EmptyOverview
          workspaceTitle={workspace.title}
          workspaceSlug={workspace.slug}
        />
      ) : (
        <ProjectsGrid
          projects={projects}
          workspaceId={workspaceId}
          canManage={canManage}
        />
      )}
    </div>
  )
}