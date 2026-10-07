import { createFileRoute } from "@tanstack/react-router"
import { ProjectCreateForm } from "@/components/projects/project-create-form"
import {
  listAssignableMembersFn,
  listProjectTagsFn,
} from "@/server/functions/projects"

export const Route = createFileRoute("/w/$workspaceSlug/projects/new")({
  loader: async ({ context }) => {
    const [members, tagOptions] = await Promise.all([
      listAssignableMembersFn({ data: { workspaceId: context.workspaceId } }),
      listProjectTagsFn({ data: { workspaceId: context.workspaceId } }),
    ])
    return { members, tagOptions }
  },
  component: NewProjectPage,
})

function NewProjectPage() {
  const { members, tagOptions } = Route.useLoaderData()
  const { workspaceId, workspace } = Route.useRouteContext()

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
