/**
 * The notification event vocabulary and its inbox copy (FR-047..050), pure by
 * the same philosophy as `workflow-states.ts`: what an event means and what
 * its row says is exactly the thing every surface must agree on, and it is
 * testable without a database.
 *
 * The vocabulary widens without a migration by design (the column is text —
 * see `notifications.ts`), so this module is the gate: a type is real here or
 * the inbox renders it as a neutral "something happened" instead of guessing.
 */

export type NotificationType =
  | "project_assigned"
  | "deliverable_assigned"
  | "task_assigned"
  | "version_review_requested"
  | "version_feedback"
  | "version_review_approved"
  | "version_review_rejected"
  | "version_review_changes_requested"

/** The polymorphic jump target each subject points at — mirrors the schema. */
export type NotificationSubjectType =
  "project" | "deliverable" | "task" | "asset_version"

export const notificationTypes: readonly NotificationType[] = [
  "project_assigned",
  "deliverable_assigned",
  "task_assigned",
  "version_review_requested",
  "version_feedback",
  "version_review_approved",
  "version_review_rejected",
  "version_review_changes_requested",
]

export const notificationSubjectTypes: readonly NotificationSubjectType[] = [
  "project",
  "deliverable",
  "task",
  "asset_version",
]

export function isNotificationType(value: string): value is NotificationType {
  return (notificationTypes as readonly string[]).includes(value)
}

export function isNotificationSubjectType(
  value: string
): value is NotificationSubjectType {
  return (notificationSubjectTypes as readonly string[]).includes(value)
}

/**
 * Decides who receives an event, and refuses itself to the actor.
 *
 * The load-bearing rule: nobody is ever notified about their own action —
 * assigning work to yourself must not ring your own bell. Duplicate ids
 * collapse (a person added to a project twice in one call is one bell), and
 * invitee-seat rows without an account are dropped: there is no user row to
 * hang a notification on.
 */
export function resolveRecipients(
  candidateIds: Array<string | null | undefined>,
  actorId: string | null
): string[] {
  return [
    ...new Set(
      candidateIds.filter((id): id is string => Boolean(id) && id !== actorId)
    ),
  ]
}

/**
 * One segment of the inbox line. `message` is the join of every segment's
 * text — two views of one sentence that cannot drift apart: surfaces that
 * only want text read `message`, surfaces that style the actor's name (the
 * person the row is about) read `parts`.
 */
export interface NotificationCopyPart {
  text: string
  /** Set for the actor's name — the styled inbox gives these weight. */
  actor?: boolean
}

const text = (value: string): NotificationCopyPart => ({ text: value })

/** The actor's name as its own segment, so the inbox can bold it. */
const name = (value: string): NotificationCopyPart => ({
  text: value,
  actor: true,
})

const COPY: Record<
  NotificationType,
  (actor: string, subject: string) => NotificationCopyPart[]
> = {
  project_assigned: (actor, subject) => [
    name(actor),
    text(" added you to "),
    text(subject),
  ],
  deliverable_assigned: (actor, subject) => [
    name(actor),
    text(" put you in charge of "),
    text(subject),
  ],
  task_assigned: (actor, subject) => [
    name(actor),
    text(" assigned "),
    text(subject),
    text(" to you"),
  ],
  version_review_requested: (actor, subject) => [
    name(actor),
    text(" sent "),
    text(subject),
    text(" for review"),
  ],
  version_feedback: (actor, subject) => [
    name(actor),
    text(" left feedback on "),
    text(subject),
  ],
  version_review_approved: (actor, subject) => [
    name(actor),
    text(" approved "),
    text(subject),
  ],
  version_review_rejected: (actor, subject) => [
    name(actor),
    text(" rejected "),
    text(subject),
  ],
  version_review_changes_requested: (actor, subject) => [
    name(actor),
    text(" requested changes to "),
    text(subject),
  ],
}

/** When the actor row is gone (accounts delete; actor_id is set-null). */
const NO_ACTOR_COPY: Record<
  NotificationType,
  (subject: string) => NotificationCopyPart[]
> = {
  project_assigned: (subject) => [text(`You were added to ${subject}`)],
  deliverable_assigned: (subject) => [text(`You now own ${subject}`)],
  task_assigned: (subject) => [text(`${subject} was assigned to you`)],
  version_review_requested: (subject) => [
    text(`${subject} is waiting for review`),
  ],
  version_feedback: (subject) => [text(`New feedback arrived on ${subject}`)],
  version_review_approved: (subject) => [text(`${subject} was approved`)],
  version_review_rejected: (subject) => [text(`${subject} was rejected`)],
  version_review_changes_requested: (subject) => [
    text(`Changes were requested on ${subject}`),
  ],
}

/** The plain text of a rendered copy — exactly what `message` is. */
function joinParts(parts: NotificationCopyPart[]): string {
  return parts.map((part) => part.text).join("")
}

/** What the inbox says for a subject that no longer resolves. */
const SUBJECT_FALLBACK: Record<NotificationSubjectType, string> = {
  project: "a project",
  deliverable: "a deliverable",
  task: "a task",
  asset_version: "a version",
}

export interface NotificationCopy {
  /** The plain line — exactly the join of `parts`, for surfaces that want text. */
  message: string
  /** The line split into segments, so a surface can style the name without re-parsing. */
  parts: NotificationCopyPart[]
  /** False when the stored type predates this module — render neutral, don't guess. */
  known: boolean
}

/**
 * The unmatched type is a widening contract: unknown values (a future event
 * written by a newer emitter, or junk) still surface, but as an honest neutral
 * row rather than copy claiming something specific was said.
 */
export function describeNotification(
  rawType: string,
  rawSubjectType: string,
  actorName: string | null,
  subjectLabel: string | null
): NotificationCopy {
  if (!isNotificationType(rawType)) {
    const parts = [text("Something happened in this workspace")]
    return { message: joinParts(parts), parts, known: false }
  }
  // A whitespace-only stored name is a gone name, not a blank byline — trim
  // before trusting either string the row carries.
  const actor = actorName?.trim() ?? ""
  const label = subjectLabel?.trim() ?? ""
  const subject =
    label.length > 0
      ? label
      : isNotificationSubjectType(rawSubjectType)
        ? SUBJECT_FALLBACK[rawSubjectType]
        : "a record"
  const parts =
    actor.length > 0
      ? COPY[rawType](actor, subject)
      : NO_ACTOR_COPY[rawType](subject)
  return { message: joinParts(parts), parts, known: true }
}
