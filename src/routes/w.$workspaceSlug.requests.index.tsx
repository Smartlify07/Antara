import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { AlertCircleIcon, InboxIcon, PlusIcon } from "lucide-react"
import { useState } from "react"
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

/**
 * `request` opens the detail dialog in place (shareable URL state — no
 * route change, no detail fetch: the dialog is fed from the list payload
 * already on the client). Anything not understood parses back undefined.
 */
export const Route = createFileRoute("/w/$workspaceSlug/requests/")({
  validateSearch: (search: Record<string, unknown>) => ({
    request:
      typeof search.request === "string" && search.request
        ? search.request
        : undefined,
  }),
  component: RequestsPage,
})

/**
 * The intake list (FR-006, FR-007). react-query rather than a route loader —
 * submitting and triage both invalidate `requestKeys.all`, keeping this list
 * and the sidebar badge on the same wire trip.
 *
 * Cards render on a four-column grid; clicking one opens the detail dialog
 * in place, from data the card already holds.
 */
function RequestsPage() {
  const { workspace, workspaceRole, isWorkspaceOwner, workspaceId } =
    Route.useRouteContext()
  const workspaceSlug = workspace.slug
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const [statusFilter, setStatusFilter] = useState<"all" | RequestTriageStatus>(
    "all"
  )

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

  const openRequest = (requestId: string) => {
    void navigate({ search: (prev) => ({ ...prev, request: requestId }) })
  }

  const closeRequest = () => {
    void navigate({ search: (prev) => ({ ...prev, request: undefined }) })
  }

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

      {isPending && (
        <p className="text-sm text-muted-foreground">Loading requests…</p>
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

      {!isPending && !error && visible.length === 0 && (
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {visible.map((request) => (
            <RequestCard
              key={request.id}
              workspaceSlug={workspaceSlug}
              request={request}
              onOpen={openRequest}
            />
          ))}
        </div>
      )}

      <RequestDetailDialog
        workspaceId={workspaceId}
        workspaceSlug={workspaceSlug}
        request={
          search.request
            ? (requests.find((r) => r.id === search.request) ?? null)
            : null
        }
        canTriage={workspaceRoleCanTriage(workspaceRole, isWorkspaceOwner)}
        onClose={closeRequest}
      />
    </div>
  )
}
