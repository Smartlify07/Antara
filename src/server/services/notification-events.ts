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

const COPY: Record<
  NotificationType,
  (actor: string, subject: string) => string
> = {
  project_assigned: (actor, subject) => `${actor} added you to ${subject}`,
  deliverable_assigned: (actor, subject) =>
    `${actor} put you in charge of ${subject}`,
  task_assigned: (actor, subject) => `${actor} assigned ${subject} to you`,
  version_review_requested: (actor, subject) =>
    `${actor} sent ${subject} for review`,
  version_feedback: (actor, subject) => `${actor} left feedback on ${subject}`,
  version_review_approved: (actor, subject) => `${actor} approved ${subject}`,
  version_review_rejected: (actor, subject) => `${actor} rejected ${subject}`,
  version_review_changes_requested: (actor, subject) =>
    `${actor} requested changes to ${subject}`,
}

/** When the actor row is gone (accounts delete; actor_id is set-null). */
const NO_ACTOR_COPY: Record<NotificationType, (subject: string) => string> = {
  project_assigned: (subject) => `You were added to ${subject}`,
  deliverable_assigned: (subject) => `You now own ${subject}`,
  task_assigned: (subject) => `${subject} was assigned to you`,
  version_review_requested: (subject) => `${subject} is waiting for review`,
  version_feedback: (subject) => `New feedback arrived on ${subject}`,
  version_review_approved: (subject) => `${subject} was approved`,
  version_review_rejected: (subject) => `${subject} was rejected`,
  version_review_changes_requested: (subject) =>
    `Changes were requested on ${subject}`,
}

/** What the inbox says for a subject that no longer resolves. */
const SUBJECT_FALLBACK: Record<NotificationSubjectType, string> = {
  project: "a project",
  deliverable: "a deliverable",
  task: "a task",
  asset_version: "a version",
}

export interface NotificationCopy {
  message: string
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
    return { message: "Something happened in this workspace", known: false }
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
  const template =
    actor.length > 0
      ? COPY[rawType](actor, subject)
      : NO_ACTOR_COPY[rawType](subject)
  return { message: template, known: true }
}
