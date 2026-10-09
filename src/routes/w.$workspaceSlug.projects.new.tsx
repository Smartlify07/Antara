import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { ProjectCreateForm } from "@/components/projects/project-create-form"
import {
  assignableMembersQuery,
  projectTagsQuery,
} from "@/lib/queries/projects"

export const Route = createFileRoute("/w/$workspaceSlug/projects/new")({
  component: NewProjectPage,
})

function NewProjectPage() {
  const { workspaceId, workspace } = Route.useRouteContext()

  // Both lists are cached under keys so creating a tag or a member later
  // invalidates them precisely, instead of every loader in the app.
  const { data: members = [], isPending: membersPending } = useQuery(
    assignableMembersQuery(workspaceId)
  )
  const { data: tagOptions = [], isPending: tagsPending } = useQuery(
    projectTagsQuery(workspaceId)
  )

  if (membersPending || tagsPending) {
    return (
      <div className="flex min-h-40 items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-medium tracking-tighter">New project</h1>
        <p className="text-sm tracking-tight text-muted-foreground">
          Name it, then set the details with the chips below.
        </p>
      </div>

      <ProjectCreateForm
        workspaceId={workspaceId}
        workspaceSlug={workspace.slug}
        members={members}
        tagOptions={tagOptions}
      />
    </div>
  )
}
