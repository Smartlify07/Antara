import { Link } from "@tanstack/react-router"
import { PlusIcon } from "lucide-react"
import { EmptyStateGraphic } from "@/components/empty-state-graphic"
import { Button } from "@/components/ui/button"

/**
 * Zero-project state for a workspace. The CTA is live once project
 * creation ships.
 */
export function EmptyOverview({
  workspaceTitle,
  workspaceSlug,
}: {
  workspaceTitle: string
  workspaceSlug: string
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 py-16 text-center">
      <EmptyStateGraphic />

      <div className="flex max-w-md flex-col gap-2">
        <h2 className="text-xl font-medium tracking-tighter">
          No projects yet
        </h2>
        <p className="text-sm tracking-tight text-balance text-muted-foreground">
          {workspaceTitle} is ready. Projects are where briefs, tasks, assets,
          and approvals come together — create your first one to get started.
        </p>
      </div>

      <Button asChild>
        <Link to="/w/$workspaceSlug/projects/new" params={{ workspaceSlug }}>
          <PlusIcon />
          Create project
        </Link>
      </Button>
    </div>
  )
}
