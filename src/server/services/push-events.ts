import { describeNotification } from "./notification-events"

/**
 * The browser-push payload composer, pure by the same philosophy as
 * `notification-events.ts`: what a push says and where it lands is exactly what
 * the service worker and the inbox must agree on, and it is testable without a
 * database or a browser.
 *
 * It reuses `describeNotification` for the body, so a push reads the same line
 * the bell renders — one source of truth for the copy. It only adds what a push
 * needs on top: a title, a deep link, and a `tag` so updates to the same subject
 * replace each other in the OS tray instead of stacking.
 */

export interface PushEventInput {
  /** The stored notification `type` (see `notification-events`). */
  type: string
  /** The stored `subjectType`, one of the polymorphic jump targets. */
  subjectType: string
  subjectId: string
  /** Resolved actor name (null when the actor row is gone). */
  actorName: string | null
  /** Resolved subject label (null when the subject no longer resolves). */
  subjectLabel: string | null
  workspaceSlug: string
  /** The subject's project slug, when a concrete project page exists. */
  projectSlug: string | null
}

export interface PushPayload {
  title: string
  body: string
  /** Root-relative destination, opened by the service worker on click. */
  url: string
  /** OS-tray grouping key: one notification per subject, replaced on update. */
  tag: string
}

/**
 * The deep link a push opens, mirroring the bell's `openNotification` routing:
 * an assigned task goes to its own page, anything with a project goes to the
 * project page, and everything else falls back to the workspace's projects.
 */
export function pushTargetUrl(
  workspaceSlug: string,
  subjectType: string,
  subjectId: string,
  projectSlug: string | null
): string {
  if (subjectType === "task" && projectSlug) {
    return `/w/${workspaceSlug}/projects/${projectSlug}/tasks/${subjectId}`
  }
  if (projectSlug) {
    return `/w/${workspaceSlug}/projects/${projectSlug}`
  }
  return `/w/${workspaceSlug}/projects`
}

export function composePushPayload(input: PushEventInput): PushPayload {
  const copy = describeNotification(
    input.type,
    input.subjectType,
    input.actorName,
    input.subjectLabel
  )

  return {
    title: "Antara",
    body: copy.message,
    url: pushTargetUrl(
      input.workspaceSlug,
      input.subjectType,
      input.subjectId,
      input.projectSlug
    ),
    tag: `${input.subjectType}:${input.subjectId}`,
  }
}
