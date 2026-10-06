import { PlusIcon } from "lucide-react"
import { EmptyStateGraphic } from "@/components/empty-state-graphic"
import { Button } from "@/components/ui/button"

/**
 * Zero-project state. The primary action stays disabled until project
 * creation ships, so the screen never shows a dead link.
 */
export function EmptyOverview({ workspaceTitle }: { workspaceTitle: string }) {
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

      <div className="flex flex-col items-center gap-2">
        <Button disabled>
          <PlusIcon />
          Create project
        </Button>
        <span className="text-xs text-muted-foreground">
          Project creation is coming soon
        </span>
      </div>
    </div>
  )
}
