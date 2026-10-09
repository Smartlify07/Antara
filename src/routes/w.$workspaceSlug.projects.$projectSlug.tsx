import { useQuery } from "@tanstack/react-query"
import { createFileRoute, notFound } from "@tanstack/react-router"
import { ProjectDetailPage } from "@/components/projects/details/project-detail-page"
import {
  assignableMembersQuery,
  projectDetailQuery,
  projectTagsQuery,
} from "@/lib/queries/projects"

export const Route = createFileRoute("/w/$workspaceSlug/projects/$projectSlug")(
  {
    component: ProjectDetailRoute,
  }
)

function ProjectDetailRoute() {
  const { workspaceId, workspaceRole, isWorkspaceOwner } =
    Route.useRouteContext()
  const { projectSlug } = Route.useParams()

  const {
    data: project,
    isPending,
    error,
  } = useQuery(projectDetailQuery(workspaceId, projectSlug))
  const { data: members = [] } = useQuery(assignableMembersQuery(workspaceId))
  const { data: tagOptions = [] } = useQuery(projectTagsQuery(workspaceId))

  // Same rule as the grid: attribute writes are admin/owner only, matching
  // `setProjectStatus`. Posting updates is open to any workspace member.
  const canEdit = isWorkspaceOwner || workspaceRole === "admin"

  if (isPending) {
    return (
      <div className="flex min-h-40 items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading project…</p>
      </div>
    )
  }

  if (error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        Could not load this project.
      </p>
    )
  }

  if (!project) throw notFound()

  return (
    <ProjectDetailPage
      workspaceId={workspaceId}
      project={project}
      members={members}
      tagOptions={tagOptions}
      canEdit={canEdit}
    />
  )
}
