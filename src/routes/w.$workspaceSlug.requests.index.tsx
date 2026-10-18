import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { AlertCircleIcon, InboxIcon, PlusIcon } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { RequestDetailDialog } from "@/components/requests/request-detail-dialog"
import {
  REQUEST_META,
  REQUEST_STATUS_ORDER,
} from "@/components/requests/request-meta"
import { SubmitRequestForm } from "@/components/requests/submit-request-form"
import {
  DEFAULT_REQUEST_VARIANT,
  REQUEST_VARIANTS,
  REQUEST_VARIANT_IDS,
} from "@/components/requests/variants/registry"
import {
  persistVariant,
  readStoredVariant,
  RequestVariantProvider,
  useRequestVariant,
} from "@/components/requests/variants/variant-context"
import { requestsQuery } from "@/lib/queries/requests"
import { workspaceRoleCanTriage } from "@/lib/request-schemas"
import type { RequestTriageStatus } from "@/db/enums"

/**
 * `request` opens the detail dialog in place (a shareable URL state — no
 * route change); `requestVariant` pins the card-design flag, and is
 * persisted to localStorage so the choice outlives the URL. Both parse
 * losslessly: anything not understood comes back undefined.
 */
export const Route = createFileRoute("/w/$workspaceSlug/requests/")({
  validateSearch: (search: Record<string, unknown>) => ({
    request:
      typeof search.request === "string" && search.request
        ? search.request
        : undefined,
    requestVariant:
      typeof search.requestVariant === "string" &&
      REQUEST_VARIANT_IDS.includes(search.requestVariant)
        ? search.requestVariant
        : undefined,
  }),
  component: RequestsPage,
})

/**
 * The intake list (FR-006, FR-007). react-query rather than a route loader —
 * submitting and triage both invalidate `requestKeys.all`, keeping this list
 * and the sidebar badge on the same wire trip.
 *
 * Cards render on a four-column grid; each card is a design variant (the
 * registry drives which). Clicking a card opens the Linear-style dialog.
 */
function RequestsPage() {
  const { workspace, workspaceRole, isWorkspaceOwner, workspaceId } =
    Route.useRouteContext()
  const workspaceSlug = workspace.slug
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  // Resolve the variant once: URL wins (and persists), then the stored
  // choice, then the default. Stale stored ids fall back cleanly.
  const [variant, setVariantState] = useState<string>(() => {
    if (search.requestVariant) {
      persistVariant(search.requestVariant)
      return search.requestVariant
    }
    const stored = readStoredVariant()
    return stored && REQUEST_VARIANT_IDS.includes(stored)
      ? stored
      : DEFAULT_REQUEST_VARIANT
  })

  const setVariant = (id: string) => {
    persistVariant(id)
    setVariantState(id)
    void navigate({
      search: (prev) => ({ ...prev, requestVariant: id }),
      replace: true,
    })
  }

  const openRequest = (requestId: string) => {
    void navigate({ search: (prev) => ({ ...prev, request: requestId }) })
  }

  const closeRequest = () => {
    void navigate({ search: (prev) => ({ ...prev, request: undefined }) })
  }

  return (
    <RequestVariantProvider variant={variant} setVariant={setVariant}>
      <RequestsInbox
        workspaceId={workspaceId}
        workspaceSlug={workspaceSlug}
        onOpenRequest={openRequest}
      />
      <RequestDetailDialog
        workspaceId={workspaceId}
        workspaceSlug={workspaceSlug}
        requestId={search.request ?? null}
        canTriage={workspaceRoleCanTriage(workspaceRole, isWorkspaceOwner)}
        onClose={closeRequest}
      />
    </RequestVariantProvider>
  )
}

function RequestsInbox({
  workspaceId,
  workspaceSlug,
  onOpenRequest,
}: {
  workspaceId: string
  workspaceSlug: string
  onOpenRequest: (requestId: string) => void
}) {
  const { variant, setVariant } = useRequestVariant()
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
        <div className="flex flex-wrap items-center gap-1.5">
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
          <label className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            Card style
            <select
              value={variant}
              onChange={(e) => setVariant(e.target.value)}
              className="rounded-lg bg-card px-2 py-1 text-xs text-foreground ring-1 ring-foreground/10 outline-none"
            >
              {REQUEST_VARIANT_IDS.map((id) => (
                <option key={id} value={id}>
                  {REQUEST_VARIANTS[id].label}
                </option>
              ))}
            </select>
          </label>
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
          {visible.map((request) => {
            const Card =
              (REQUEST_VARIANTS[variant] ?? REQUEST_VARIANTS[DEFAULT_REQUEST_VARIANT])
                .Card
            return (
              <Card
                key={request.id}
                workspaceSlug={workspaceSlug}
                request={request}
                onOpen={onOpenRequest}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
