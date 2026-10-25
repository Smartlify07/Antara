import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { AlertCircleIcon, InboxIcon, PlusIcon } from "lucide-react"
import { useState } from "react"
import { AppLoading } from "@/components/app-loading"
import { Button } from "@/components/ui/button"
import { RequestCard } from "@/components/requests/request-card"
import { RequestDetailDialog } from "@/components/requests/request-detail-dialog"
import {
  REQUEST_META,
  REQUEST_STATUS_ORDER,
} from "@/components/requests/request-meta"
import { SubmitRequestForm } from "@/components/requests/submit-request-form"
import { requestsQuery } from "@/lib/queries/requests"
import { workspaceRoleCanTriage } from "@/lib/request-schemas"
import type { RequestTriageStatus } from "@/db/enums"

export const Route = createFileRoute("/w/$workspaceSlug/requests/")({
  component: RequestsPage,
})

/**
 * The intake list (FR-006, FR-007). react-query rather than a route loader —
 * submitting and triage both invalidate `requestKeys.all`, keeping this list
 * and the sidebar badge on the same wire trip.
 *
 * Cards render on a four-column grid. Clicking one opens the detail dialog
 * immediately: the open request is local state (search params made the
 * Radix transition stutter and were never worth a router pass — the dialog
 * is fed from the list payload already on the client, so nothing loads).
 */
function RequestsPage() {
  const { workspace, workspaceRole, isWorkspaceOwner, workspaceId } =
    Route.useRouteContext()
  const workspaceSlug = workspace.slug
  const [statusFilter, setStatusFilter] = useState<"all" | RequestTriageStatus>(
    "all"
  )
  // Only the id lives in state; the dialog reads the live list payload, so
  // an accept/decline inside the dialog re-renders it from fresh data.
  const [openRequestId, setOpenRequestId] = useState<string | null>(null)

  const {
    data: requests = [],
    isPending,
    error,
  } = useQuery(requestsQuery(workspaceId))

  const visible =
    statusFilter === "all"
      ? requests
      : requests.filter((request) => request.triageStatus === statusFilter)

  const counts = {
    all: requests.length,
    ...Object.fromEntries(
      REQUEST_STATUS_ORDER.map((status) => [
        status,
        requests.filter((request) => request.triageStatus === status).length,
      ])
    ),
  } as Record<"all" | RequestTriageStatus, number>

  // One arrival: the count chips and the grid read the same list, so nothing
  // of the page paints until it lands — the shell's pulsing logo covers the
  // fetch instead of a line in the middle of the page.
  if (isPending) return <AppLoading />

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium tracking-tighter">Requests</h1>
          <p className="text-sm tracking-tight text-muted-foreground">
            {requests.length === 0
              ? "Stakeholders ask; the creative team answers here."
              : `${requests.length} ${requests.length === 1 ? "request" : "requests"} in this workspace.`}
          </p>
        </div>
        <SubmitRequestForm
          workspaceId={workspaceId}
          workspaceSlug={workspaceSlug}
        >
          <Button size="sm">
            <PlusIcon />
            New request
          </Button>
        </SubmitRequestForm>
      </div>

      {requests.length > 0 && (
        <div className="flex flex-wrap gap-1.5" role="tablist">
          {(["all", ...REQUEST_STATUS_ORDER] as const).map((status) => (
            <Button
              key={status}
              type="button"
              size="sm"
              variant={statusFilter === status ? "default" : "outline"}
              role="tab"
              aria-selected={statusFilter === status}
              onClick={() => setStatusFilter(status)}
            >
              {status === "all" ? "All" : REQUEST_META[status].label}
              <span className="ml-1 text-xs opacity-70">{counts[status]}</span>
            </Button>
          ))}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <AlertCircleIcon className="size-4 shrink-0" />
          {error instanceof Error ? error.message : "Could not load requests."}
        </div>
      )}

      {!error && visible.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-muted">
            <InboxIcon className="size-6 text-muted-foreground" />
          </div>
          <div className="flex max-w-md flex-col gap-2">
            <h2 className="text-xl font-medium tracking-tighter">
              {counts.all === 0 ? "No requests yet" : "Nothing in this filter"}
            </h2>
            <p className="text-sm tracking-tight text-balance text-muted-foreground">
              {counts.all === 0
                ? "When someone in this workspace needs something made, they ask here and a lead triages it into a project."
                : "Try another status, or submit a new request."}
            </p>
          </div>
        </div>
      )}

      {visible.length > 0 && (
        <div className="grid grid-cols-1 gap-4 min-[1740px]:grid-cols-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((request) => (
            <RequestCard
              key={request.id}
              workspaceSlug={workspaceSlug}
              request={request}
              onOpen={setOpenRequestId}
            />
          ))}
        </div>
      )}

      <RequestDetailDialog
        workspaceId={workspaceId}
        workspaceSlug={workspaceSlug}
        request={
          openRequestId
            ? (requests.find((r) => r.id === openRequestId) ?? null)
            : null
        }
        canTriage={workspaceRoleCanTriage(workspaceRole, isWorkspaceOwner)}
        onClose={() => setOpenRequestId(null)}
      />
    </div>
  )
}
