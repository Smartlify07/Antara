/**
 * The Linear-style request dialog: the whole triage surface (brief, meta,
 * triage toolbar, brief thread) opens in place over the inbox instead of
 * routing to a page. `requestId` comes from `?request=` on the list route,
 * so a dialog state is a shareable URL; closing (Esc, backdrop, ✕) drops
 * the param and returns to the grid untouched.
 */
import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { ExternalLinkIcon } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { RequestTriageBar } from "@/components/requests/request-triage-bar"
import { RequestThread } from "@/components/requests/request-thread"
import { REQUEST_META } from "@/components/requests/request-meta"
import { requestQuery } from "@/lib/queries/requests"
import { formatDueDate, formatRelativeTime, isOverdue } from "@/lib/time"
import {
  GRADIENT_SCRIM_CLASS,
  GRADIENT_TEXT,
  requestGradient,
} from "./variants/card-gradient"

export function RequestDetailDialog({
  workspaceId,
  workspaceSlug,
  requestId,
  canTriage,
  onClose,
}: {
  workspaceId: string
  workspaceSlug: string
  requestId: string | null
  canTriage: boolean
  onClose: () => void
}) {
  // "" is a never-fetched placeholder key for the closed state.
  const { data: request = null, isPending, error } = useQuery({
    ...requestQuery(workspaceId, requestId ?? ""),
    enabled: requestId !== null,
  })

  // Artwork from the id alone, so the header gradient is up while loading.
  const headerGradient = requestGradient({ id: requestId ?? "" })
  const meta = request ? REQUEST_META[request.triageStatus] : null
  const deadlineOverdue =
    request?.desiredDeadline !== null &&
    request?.desiredDeadline !== undefined &&
    isOverdue(request.desiredDeadline) &&
    (request.triageStatus === "open" || request.triageStatus === "needs_info")

  return (
    <Dialog
      open={requestId !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="flex max-h-[85vh] w-full max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl lg:max-w-5xl">
        <div className="relative shrink-0 overflow-hidden">
          <div className="absolute inset-0" style={headerGradient} />
          <div className={GRADIENT_SCRIM_CLASS} />
          <div className="relative flex flex-col gap-2 p-5 pr-10">
            <DialogTitle className={GRADIENT_TEXT.title + " line-clamp-2 text-xl leading-snug"}>
              {request ? request.title : "Loading request…"}
            </DialogTitle>
            <DialogDescription className="text-xs text-white/75">
              {request
                ? `requested ${formatRelativeTime(request.createdAt)}${
                    request.requesterName
                      ? ` by ${request.requesterName}`
                      : ""
                  }`
                : "…"}
            </DialogDescription>
            {request && (
              <div className="flex flex-wrap items-center gap-1.5">
                {meta && (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${GRADIENT_TEXT.chip}`}>
                    {meta.label}
                  </span>
                )}
                {request.category && (
                  <span className={`text-xs ${GRADIENT_TEXT.meta}`}>{request.category}</span>
                )}
                {request.priority && (
                  <span className={`text-xs capitalize ${GRADIENT_TEXT.accent}`}>
                    {request.priority} priority
                  </span>
                )}
                {request.desiredDeadline && (
                  <span
                    className={
                      deadlineOverdue
                        ? "text-xs font-medium text-rose-200"
                        : `text-xs ${GRADIENT_TEXT.meta}`
                    }
                  >
                    wanted by {formatDueDate(request.desiredDeadline)}
                  </span>
                )}
                {request.linkedProjectId && request.linkedProjectSlug && (
                  <Link
                    to="/w/$workspaceSlug/projects/$projectSlug"
                    params={{ workspaceSlug, projectSlug: request.linkedProjectSlug }}
                    className="inline-flex items-center gap-1 rounded-md bg-emerald-500/25 px-1.5 py-0.5 text-xs font-medium text-white ring-1 ring-white/25 hover:bg-emerald-500/35"
                  >
                    → {request.linkedProjectTitle ?? "Project"}
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {isPending && (
            <p className="text-sm text-muted-foreground">Loading request…</p>
          )}

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
            >
              {error instanceof Error
                ? error.message
                : "Could not load the request."}
            </div>
          )}

          {request && !isPending && (
            <>
              <div className="text-sm leading-relaxed break-words whitespace-pre-wrap">
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

              <div className="mt-4">
                <RequestTriageBar
                  workspaceId={workspaceId}
                  requestId={requestId ?? ""}
                  triageStatus={request.triageStatus}
                  canTriage={canTriage}
                />
              </div>

              <div className="mt-4">
                <RequestThread workspaceId={workspaceId} requestId={requestId ?? ""} />
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
