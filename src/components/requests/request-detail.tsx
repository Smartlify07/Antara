import type { ComponentProps } from "react"
import { Link } from "@tanstack/react-router"
import { CalendarIcon, ExternalLinkIcon, FlagIcon, TagIcon } from "lucide-react"
import { RequestTriageBar } from "@/components/requests/request-triage-bar"
import { RequestThread } from "@/components/requests/request-thread"
import { RequesterAvatar } from "@/components/requests/request-avatar"
import {
  PRIORITY_BADGE,
  REQUEST_META,
} from "@/components/requests/request-meta"
import { cn } from "@/lib/utils"
import { formatDueDate, formatRelativeTime, isOverdue } from "@/lib/time"
import type { RequestListItem } from "@/server/services/request-service"

/**
 * The request representation the detail dialog established — title, the meta
 * row (status pill, tinted priority, category, wanted-by date, requester),
 * the labelled Brief and Reference links sections, the linked-project chip,
 * the triage toolbar and the brief thread. Shared with the detail route so
 * the page draws exactly what the modal draws, same classes and sections.
 */

/** The shared title treatment: the dialog's DialogTitle and the route's h1. */
export const requestTitleClass = "font-heading text-xl leading-snug font-medium"

/**
 * The meta row. Accepts div props because the dialog renders it as the
 * Radix description (asChild merges the description id onto it); the route
 * renders it plain.
 */
export function RequestMetaRow({
  request,
  className,
  ...rest
}: ComponentProps<"div"> & { request: RequestListItem }) {
  const meta = REQUEST_META[request.triageStatus]
  const deadlineOverdue =
    request.desiredDeadline != null &&
    isOverdue(request.desiredDeadline) &&
    (request.triageStatus === "open" || request.triageStatus === "needs_info")

  return (
    <div
      className={cn(
        "mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground",
        className
      )}
      {...rest}
    >
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium ${meta.badgeClass}`}
      >
        {meta.label}
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
  )
}

/**
 * Everything under the meta row. `threadFlush` squares the thread off at the
 * bottom for the dialog, whose scroll container rounds the joint; the route
 * keeps the fully rounded panel.
 */
export function RequestDetailBody({
  workspaceId,
  workspaceSlug,
  request,
  canTriage,
  threadFlush = false,
}: {
  workspaceId: string
  workspaceSlug: string
  request: RequestListItem
  canTriage: boolean
  threadFlush?: boolean
}) {
  return (
    <>
      <div className="mt-4">
        <p className="text-sm font-medium tracking-tight">Brief</p>
        <div className="mt-2 text-sm leading-relaxed break-words whitespace-pre-wrap">
          {request.brief}
        </div>
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
          params={{ workspaceSlug, projectSlug: request.linkedProjectSlug }}
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
          flush={threadFlush}
        />
      </div>
    </>
  )
}
