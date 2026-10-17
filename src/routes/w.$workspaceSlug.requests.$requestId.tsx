import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { ExternalLinkIcon } from "lucide-react"
import { RequestTriageBar } from "@/components/requests/request-triage-bar"
import { RequestThread } from "@/components/requests/request-thread"
import { REQUEST_META } from "@/components/requests/request-meta"
import { requestQuery } from "@/lib/queries/requests"
import { workspaceRoleCanTriage } from "@/lib/request-schemas"
import { formatDueDate, formatRelativeTime, isOverdue } from "@/lib/time"

export const Route = createFileRoute("/w/$workspaceSlug/requests/$requestId")({
  component: RequestDetailPage,
})

/**
 * The triage surface for one request (FR-008..011): the brief and its meta,
 * the triage toolbar for admins/leads while the request is alive, and the
 * brief thread where the conversation — and every decision record — lives.
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

  if (isPending) {
    return <p className="text-sm text-muted-foreground">Loading request…</p>
  }

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

  const meta = REQUEST_META[request.triageStatus]
  const canTriage = workspaceRoleCanTriage(workspaceRole, isWorkspaceOwner)
  const deadlineOverdue =
    request.desiredDeadline !== null &&
    isOverdue(request.desiredDeadline) &&
    (request.triageStatus === "open" || request.triageStatus === "needs_info")

  return (
    <div className="flex flex-col gap-4">
      <header className="rounded-xl border bg-card p-5" id={request.id}>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${meta.badgeClass}`}
          >
            {meta.label}
          </span>
          <span className="text-xs text-muted-foreground">
            requested {formatRelativeTime(request.createdAt)}
          </span>
          {request.desiredDeadline && (
            <span
              className={
                deadlineOverdue
                  ? "text-xs font-medium text-destructive"
                  : "text-xs text-muted-foreground"
              }
            >
              wanted by {formatDueDate(request.desiredDeadline)}
            </span>
          )}
        </div>

        <h1 className="mt-2 text-2xl font-medium tracking-tighter">
          {request.title}
        </h1>

        <p className="mt-1 text-xs text-muted-foreground">
          <span
            aria-hidden
            className="mr-1.5 inline-flex size-5 items-center justify-center rounded-full bg-muted align-middle text-[10px] font-medium"
          >
            {(request.requesterName?.trim()[0] ?? "?").toUpperCase()}
          </span>
          {request.requesterName ?? "Former member"}
          {request.category && (
            <>
              <span aria-hidden> · </span>
              {request.category}
            </>
          )}
          {request.priority && (
            <>
              <span aria-hidden> · </span>
              {request.priority[0].toUpperCase() +
                request.priority.slice(1)}{" "}
              priority
            </>
          )}
        </p>

        {request.linkedProjectSlug && (
          <Link
            to="/w/$workspaceSlug/projects/$projectSlug"
            params={{ workspaceSlug, projectSlug: request.linkedProjectSlug }}
            className="mt-3 inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700 hover:underline dark:bg-emerald-500/15 dark:text-emerald-300"
          >
            → {request.linkedProjectTitle ?? "Project"}
          </Link>
        )}

        <div className="mt-4 text-sm leading-relaxed break-words whitespace-pre-wrap">
          {request.brief}
        </div>

        {request.referenceLinks && request.referenceLinks.length > 0 && (
          <ul className="mt-4 flex flex-col gap-1">
            {request.referenceLinks.map((link) => (
              <li key={link}>
                <a
                  href={link}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 text-sm underline underline-offset-2 hover:text-foreground"
                >
                  <ExternalLinkIcon className="size-3 shrink-0" />
                  <span className="truncate">{link}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </header>

      <RequestTriageBar
        workspaceId={workspaceId}
        requestId={requestId}
        triageStatus={request.triageStatus}
        canTriage={canTriage}
      />

      <RequestThread workspaceId={workspaceId} requestId={requestId} />
    </div>
  )
}
