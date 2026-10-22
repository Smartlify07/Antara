import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { AppLoading } from "@/components/app-loading"
import {
  RequestDetailBody,
  RequestMetaRow,
  requestTitleClass,
} from "@/components/requests/request-detail"
import { requestQuery } from "@/lib/queries/requests"
import { workspaceRoleCanTriage } from "@/lib/request-schemas"

export const Route = createFileRoute("/w/$workspaceSlug/requests/$requestId")({
  component: RequestDetailPage,
})

/**
 * The triage surface for one request (FR-008..011). Draws exactly what the
 * request dialog draws — the shared representation in request-detail.tsx —
 * capped to the dialog's proportions so the record reads the same wherever
 * it is opened. The thread's fetch stays request-scoped; everything under
 * the meta row is the body the card/list payload already carries.
 */
function RequestDetailPage() {
  const { workspace, workspaceRole, isWorkspaceOwner, workspaceId } =
    Route.useRouteContext()
  const workspaceSlug = workspace.slug
  const { requestId } = Route.useParams()

  const {
    data: request = null,
    isPending,
    error,
  } = useQuery(requestQuery(workspaceId, requestId))

  // The record is the whole page — nothing renders until it arrives, and the
  // shell's pulsing logo covers the fetch.
  if (isPending) return <AppLoading />

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
      >
        {error instanceof Error ? error.message : "Could not load the request."}
      </div>
    )
  }

  if (!request) {
    return (
      <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
        This request does not exist in this workspace.
      </div>
    )
  }

  const canTriage = workspaceRoleCanTriage(workspaceRole, isWorkspaceOwner)

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col lg:max-w-4xl">
      <h1 className={requestTitleClass}>{request.title}</h1>
      <RequestMetaRow request={request} />

      <RequestDetailBody
        workspaceId={workspaceId}
        workspaceSlug={workspaceSlug}
        request={request}
        canTriage={canTriage}
      />
    </div>
  )
}
