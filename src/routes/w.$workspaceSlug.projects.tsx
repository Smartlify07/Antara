import { createFileRoute } from "@tanstack/react-router"
import { EmptyOverview } from "@/components/workspace/empty-overview"
import { ProjectsGrid } from "@/components/workspace/projects-grid"
import { listProjectsFn } from "@/server/functions/projects"

export const Route = createFileRoute("/w/$workspaceSlug/projects")({
  loader: ({ context }) =>
    listProjectsFn({ data: { workspaceId: context.workspaceId } }),
  component: ProjectsPage,
})

function ProjectsPage() {
  const projects = Route.useLoaderData()
  const { workspace, workspaceRole, isWorkspaceOwner, workspaceId } =
    Route.useRouteContext()

  const canManage = isWorkspaceOwner || workspaceRole === "admin"

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-medium tracking-tighter">Projects</h1>
        <p className="text-sm tracking-tight text-muted-foreground">
          {projects.length === 0
            ? "Briefs, tasks, and assets live here."
            : `${projects.length} ${projects.length === 1 ? "project" : "projects"} in this workspace.`}
        </p>
      </div>

      {projects.length === 0 ? (
        <EmptyOverview workspaceTitle={workspace.title} />
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
