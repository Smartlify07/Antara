import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useDecideVersion } from "@/lib/queries/versions"
import type { DecisionKind } from "@/components/projects/details/deliverables/version-meta"
import { DecideDialog } from "@/components/projects/details/deliverables/decide-dialog"

/**
 * The decision, made where the version is being looked at — the landing
 * page's review panel on the library's record sheet. Both decisions confirm
 * through the dialog: `approved` is terminal for user actions (only the next
 * version's submission supersedes it), so the confirm is the guard against
 * an irreversible mis-click, and the optional note rides along.
 *
 * Rendered only when the server says the viewer may decide this asset's
 * project — the same fact the cabinet decides with. The write goes through
 * the version lane's `decideVersionFn`; this lane stays read-only.
 */
export function VersionDecideActions({
  workspaceId,
  projectId,
  versionId,
  canDecide,
}: {
  workspaceId: string
  projectId: string
  versionId: string
  canDecide: boolean
}) {
  const [decideKind, setDecideKind] = useState<DecisionKind | null>(null)
  const decide = useDecideVersion(workspaceId)

  if (!canDecide) return null

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        disabled={decide.isPending}
        onClick={() => setDecideKind("approved")}
      >
        Approve
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={decide.isPending}
        onClick={() => setDecideKind("changes_requested")}
      >
        Request changes
      </Button>

      {decide.isError && (
        <p role="alert" className="text-xs text-destructive">
          {decide.error instanceof Error
            ? decide.error.message
            : "Could not record the decision."}
        </p>
      )}

      {decideKind && (
        <DecideDialog
          kind={decideKind}
          busy={decide.isPending}
          onClose={() => setDecideKind(null)}
          onConfirm={(comment) =>
            decide.mutate(
              {
                projectId,
                versionId,
                decision: decideKind,
                comment,
              },
              { onSettled: () => setDecideKind(null) }
            )
          }
        />
      )}
    </div>
  )
}
