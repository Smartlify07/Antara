/**
 * The Linear-style request dialog: opens immediately on card click — no
 * router involvement at all. The content is fed from the data the card
 * already carries (the grid owns the one list fetch), so nothing loads on
 * open. Radix/shadcn Dialog gives the transition; only the conversation
 * thread fetches as it mounts, since it lives off the list payload.
 */
import { Link } from "@tanstack/react-router"
import {
  CalendarIcon,
  ExternalLinkIcon,
  FlagIcon,
  MessageSquareIcon,
  TagIcon,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { RequestTriageBar } from "@/components/requests/request-triage-bar"
import { RequestThread } from "@/components/requests/request-thread"
import { RequesterAvatar } from "@/components/requests/request-avatar"
import {
  PRIORITY_BADGE,
  REQUEST_META,
} from "@/components/requests/request-meta"
import { formatDueDate, formatRelativeTime, isOverdue } from "@/lib/time"
import type { RequestListItem } from "@/server/services/request-service"

export function RequestDetailDialog({
  workspaceId,
  workspaceSlug,
  request,
  canTriage,
  onClose,
}: {
  workspaceId: string
  workspaceSlug: string
  /** The list item whose card opened this dialog — already on the client. */
  request: RequestListItem | null
  canTriage: boolean
  onClose: () => void
}) {
  const open = request !== null
  const meta = request ? REQUEST_META[request.triageStatus] : null
  const deadlineOverdue =
    request != null &&
    request.desiredDeadline != null &&
    isOverdue(request.desiredDeadline) &&
    (request.triageStatus === "open" || request.triageStatus === "needs_info")

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent className="flex max-h-[85vh] w-full max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl lg:max-w-4xl">
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {request ? (
            <>
              <DialogTitle className="font-heading text-xl leading-snug font-medium">
                {request.title}
              </DialogTitle>
              <DialogDescription asChild>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium ${meta?.badgeClass ?? ""}`}
                  >
                    {meta?.label}
                  </span>
                  {request.priority && (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium capitalize ${PRIORITY_BADGE[request.priority]}`}
                    >
                      <FlagIcon aria-hidden className="size-3 shrink-0" />
                      {request.priority}
                    </span>
                  )}
                  {request.category && (
                    <span className="inline-flex items-center gap-1">
                      <TagIcon aria-hidden className="size-3.5 shrink-0" />
                      {request.category}
                    </span>
                  )}
                  {request.desiredDeadline && (
                    <span
                      title={`Wanted by ${formatDueDate(request.desiredDeadline)}`}
                      className={
                        deadlineOverdue
                          ? "inline-flex items-center gap-1 font-medium text-destructive"
                          : "inline-flex items-center gap-1"
                      }
                    >
                      <CalendarIcon aria-hidden className="size-3.5 shrink-0" />
                      {formatDueDate(request.desiredDeadline)}
                    </span>
                  )}
                  {request.messageCount > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <MessageSquareIcon
                        aria-hidden
                        className="size-3.5 shrink-0"
                      />
                      {request.messageCount}{" "}
                      {request.messageCount === 1 ? "message" : "messages"}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5">
                    <RequesterAvatar
                      userId={request.requesterId}
                      name={request.requesterName}
                      image={request.requesterImage}
                    />
                    <span className="font-medium text-foreground">
                      {request.requesterName ?? "Former member"}
                    </span>
                    <span
                      aria-hidden
                      className="inline-block size-1 rounded-full bg-muted-foreground/50"
                    />
                    <span>{formatRelativeTime(request.createdAt)}</span>
                  </span>
                </div>
              </DialogDescription>

              <div className="mt-4 text-sm leading-relaxed break-words whitespace-pre-wrap">
                {request.brief}
              </div>

              {request.referenceLinks && request.referenceLinks.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium tracking-tight">
                    Reference links{" "}
                    <span className="font-normal text-muted-foreground">
                      (attached when the request was submitted)
                    </span>
                  </p>
                  <ul className="mt-2 flex flex-col gap-1">
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
                </div>
              )}

              {request.linkedProjectId && request.linkedProjectSlug && (
                <Link
                  to="/w/$workspaceSlug/projects/$projectSlug"
                  params={{
                    workspaceSlug,
                    projectSlug: request.linkedProjectSlug,
                  }}
                  className="mt-4 inline-flex w-fit items-center gap-1 rounded-md bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700 hover:underline dark:bg-emerald-500/15 dark:text-emerald-300"
                >
                  → {request.linkedProjectTitle ?? "Project"}
                </Link>
              )}

              <div className="mt-4">
                <RequestTriageBar
                  workspaceId={workspaceId}
                  requestId={request.id}
                  triageStatus={request.triageStatus}
                  canTriage={canTriage}
                />
              </div>

              <div className="mt-4">
                <RequestThread
                  workspaceId={workspaceId}
                  requestId={request.id}
                />
              </div>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
