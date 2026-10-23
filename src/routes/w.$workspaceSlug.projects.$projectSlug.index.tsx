import { useQuery } from "@tanstack/react-query"
import { createFileRoute, notFound } from "@tanstack/react-router"
import { AppLoading } from "@/components/app-loading"
import { ProjectDetailPage } from "@/components/projects/details/project-detail-page"
import {
  assignableMembersQuery,
  projectDetailQuery,
  projectTagsQuery,
} from "@/lib/queries/projects"

export const Route = createFileRoute(
  "/w/$workspaceSlug/projects/$projectSlug/"
)({
  component: ProjectDetailRoute,
})

function ProjectDetailRoute() {
  const { workspaceId, workspaceRole, isWorkspaceOwner } =
    Route.useRouteContext()
  const { workspaceSlug, projectSlug } = Route.useParams()

  const {
    data: project,
    isPending: projectPending,
    error,
  } = useQuery(projectDetailQuery(workspaceId, projectSlug))
  const { data: members = [], isPending: membersPending } = useQuery(
    assignableMembersQuery(workspaceId)
  )
  const { data: tagOptions = [], isPending: tagsPending } = useQuery(
    projectTagsQuery(workspaceId)
  )

  // Same rule as the grid: attribute writes are admin/owner only, matching
  // `setProjectStatus`. Posting updates is open to any workspace member.
  const canEdit = isWorkspaceOwner || workspaceRole === "admin"

  // One arrival for the page: the pills read the member and tag lists in the
  // same render as the project, so letting the project land alone would
  // briefly present empty selects as real data. All three settle first, and
  // the shell's pulsing logo covers the fetch.
  if (projectPending || membersPending || tagsPending) {
    return <AppLoading />
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
      workspaceSlug={workspaceSlug}
      workspaceId={workspaceId}
      project={project}
      members={members}
      tagOptions={tagOptions}
      canEdit={canEdit}
    />
  )
}
