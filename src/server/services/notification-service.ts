import { and, count, desc, eq, inArray, isNull, sql } from "drizzle-orm"
import { db } from "@/db"
import { user } from "@/db/schema/auth"
import { assets, assetVersions } from "@/db/schema/assets"
import { deliverables } from "@/db/schema/deliverables"
import { notifications } from "@/db/schema/notifications"
import { projectMembers, projects } from "@/db/schema/projects"
import { tasks } from "@/db/schema/tasks"
import { roles, team, workspaces } from "@/db/schema/workspaces"
import type {
  NotificationCopyPart,
  NotificationSubjectType,
  NotificationType,
} from "./notification-events"
import { describeNotification, resolveRecipients } from "./notification-events"

// The payload boundary: a client that reads rows reads the copy parts through
// here too — the events module stays the source of truth.
export type { NotificationCopyPart } from "./notification-events"

/**
 * The notification emitter and the inbox reads it feeds (FR-047..050).
 *
 * Emission is fail-soft like outbound email (handoff §6): a notification is a
 * by-product of real work — assigning a task, submitting a version — and it
 * must never be able to fail that work or surface its error to the user.
 * Every public `notify*` entry point therefore resolves and writes inside one
 * swallow-everything path, and callers fire-and-forget with `void`.
 *
 * Reading is strictly scoped: a notification is owned by its `user_id` and
 * carries `workspace_id`, and every read filters on the session user plus the
 * workspace it was rendered in.
 */

/** The freshest rows the inbox shows; enough for a bell, no pagination yet. */
const INBOX_LIMIT = 25

interface EmitEvent {
  workspaceId: string
  actorId: string | null
  type: NotificationType
  subjectType: NotificationSubjectType
  subjectId: string
  /** Candidate recipients; the actor is dropped and duplicates collapse. */
  recipientIds: string[]
}

/** The one writer of notification rows, wrapped in the fail-soft contract. */
async function emitEvent(event: EmitEvent): Promise<void> {
  try {
    const recipients = resolveRecipients(event.recipientIds, event.actorId)
    if (recipients.length === 0) return

    await db.insert(notifications).values(
      recipients.map((userId) => ({
        workspaceId: event.workspaceId,
        userId,
        type: event.type,
        subjectType: event.subjectType,
        subjectId: event.subjectId,
        actorId: event.actorId,
      }))
    )
  } catch (error) {
    // Deliberately one log line, server-side only (handoff §6): the trigger
    // action has already succeeded for the user, and the notification for a
    // future attempt can be re-emitted whenever the same action runs again.
    console.error("[notifications] event could not be recorded:", error)
  }
}

// ---------------------------------------------------------------------------
// Recipient resolution (membership rows → accounts)
// ---------------------------------------------------------------------------

/**
 * Resolves the accounts behind "membership-shaped" recipients — rows that
 * carry a `user_id` when the person has an account, or just an email for an
 * invitee seat. Email-only rows resolve to the account registered under that
 * address (the same lowercased-email convention `listProjectMembers` joins
 * with); seats with no account yet are dropped — there is no user row to hang
 * a notification on.
 */
async function userIdsForMembers(
  members: Array<{ userId: string | null; email?: string | null }>
): Promise<string[]> {
  const direct = members
    .map((member) => member.userId)
    .filter((userId): userId is string => Boolean(userId))

  const emails = members
    .filter((member) => !member.userId && member.email)
    .map((member) => (member.email as string).toLowerCase())

  let emailRegistered: string[] = []
  if (emails.length > 0) {
    const rows = await db
      .select({ id: user.id })
      .from(user)
      .where(inArray(sql`lower(${user.email})`, [...new Set(emails)]))
    emailRegistered = rows.map((row) => row.id)
  }

  return [...new Set([...direct, ...emailRegistered])]
}

/** `team` rows → accounts (workspace members with seats and accounts). */
async function userIdsFromTeamIds(
  workspaceId: string,
  teamIds: string[]
): Promise<string[]> {
  if (teamIds.length === 0) return []
  const rows = await db
    .select({ userId: team.userId })
    .from(team)
    .where(and(eq(team.workspaceId, workspaceId), inArray(team.id, teamIds)))
  return rows
    .map((row) => row.userId)
    .filter((userId): userId is string => Boolean(userId))
}

/** `project_members` rows → accounts, via user id or lowercased email. */
async function userIdsFromProjectMemberIds(
  memberIds: string[]
): Promise<string[]> {
  if (memberIds.length === 0) return []
  const rows = await db
    .select({
      userId: projectMembers.userId,
      memberEmail: projectMembers.email,
      accountUserId: user.id,
    })
    .from(projectMembers)
    .leftJoin(user, sql`lower(${user.email}) = lower(${projectMembers.email})`)
    .where(inArray(projectMembers.id, memberIds))

  return rows.flatMap((row) => {
    // A membership resolves to one person: prefer the direct id, else the
    // account that registered under the invitee email.
    if (row.userId) return [row.userId]
    if (row.memberEmail && row.accountUserId) return [row.accountUserId]
    return []
  })
}

// ---------------------------------------------------------------------------
// Emitter entry points — one per triggering action, all fail-soft
// ---------------------------------------------------------------------------

/**
 * Someone was added to a project (FR-047a). Callers pass the membership rows
 * that were actually written — `returning` after `onConflictDoNothing`
 * filters re-assignments out, so nobody hears about a seat they already held.
 */
export function notifyProjectMembersAdded(
  workspaceId: string,
  projectId: string,
  actorId: string,
  members: Array<{ userId: string | null; email?: string | null }>
): Promise<void> {
  return (async () => {
    const recipientIds = await userIdsForMembers(members)
    await emitEvent({
      workspaceId,
      actorId,
      type: "project_assigned",
      subjectType: "project",
      subjectId: projectId,
      recipientIds,
    })
  })()
}

/**
 * A deliverable has an owner again (FR-047b). The owner chip renders people,
 * so seats without accounts are skipped naturally by the resolver.
 */
export function notifyDeliverableOwnerAssigned(
  workspaceId: string,
  // Kept in the signature for uniform call sites; the deliverable's project
  // is re-resolved on read, so the emit itself needs nothing from it.
  _projectId: string,
  deliverableId: string,
  actorId: string,
  ownerTeamId: string | null
): Promise<void> {
  return (async () => {
    const recipientIds = ownerTeamId
      ? await userIdsFromTeamIds(workspaceId, [ownerTeamId])
      : []
    await emitEvent({
      workspaceId,
      actorId,
      type: "deliverable_assigned",
      subjectType: "deliverable",
      subjectId: deliverableId,
      recipientIds,
    })
  })()
}

/**
 * Tasks were assigned (FR-047c, FR-052). Works for the initial assignment and
 * for later ones — callers pass only the memberships that became assignees.
 */
export function notifyTaskAssignees(
  workspaceId: string,
  // Same as the deliverable emitter: kept for uniform call sites, unused on
  // emit because the task's project is re-resolved on read.
  _projectId: string,
  taskId: string,
  actorId: string,
  memberIds: string[]
): Promise<void> {
  return (async () => {
    const recipientIds = await userIdsFromProjectMemberIds(memberIds)
    await emitEvent({
      workspaceId,
      actorId,
      type: "task_assigned",
      subjectType: "task",
      subjectId: taskId,
      recipientIds,
    })
  })()
}

/**
 * A version needs review (FR-026, FR-047d). Reviewers are the people
 * `canDecideVersion` admits for the project — its leads, plus the workspace's
 * admins and owner, exactly the population the Reviews queue serves.
 */
export function notifyReviewersOfSubmit(
  workspaceId: string,
  projectId: string,
  versionId: string,
  actorId: string
): Promise<void> {
  return (async () => {
    const [leadRows, adminRows, workspaceRows] = await Promise.all([
      db
        .select({ userId: projectMembers.userId, email: projectMembers.email })
        .from(projectMembers)
        .innerJoin(roles, eq(projectMembers.roleId, roles.id))
        .where(
          and(
            eq(projectMembers.projectId, projectId),
            eq(projectMembers.status, "active"),
            eq(roles.title, "lead")
          )
        ),
      db
        .select({ userId: team.userId })
        .from(team)
        .innerJoin(roles, eq(team.roleId, roles.id))
        .where(
          and(
            eq(team.workspaceId, workspaceId),
            eq(team.status, "active"),
            eq(roles.title, "admin"),
            // Same floor as `resolveMembership`: a seat is not a person here
            // until it was accepted.
            sql`${team.joinedAt} IS NOT NULL`
          )
        ),
      db
        .select({ ownerId: workspaces.ownerId })
        .from(workspaces)
        .where(eq(workspaces.id, workspaceId))
        .limit(1),
    ])

    const recipients = await userIdsForMembers([
      ...leadRows,
      ...adminRows,
      { userId: workspaceRows[0]?.ownerId ?? null, email: null },
    ])

    await emitEvent({
      workspaceId,
      actorId,
      type: "version_review_requested",
      subjectType: "asset_version",
      subjectId: versionId,
      recipientIds: recipients,
    })
  })()
}

/**
 * Feedback landed on a submitted version (FR-027, FR-047e) — the submitter's
 * bell, since they are the one waiting on the review thread.
 */
export function notifySubmitterOfFeedback(
  workspaceId: string,
  versionId: string,
  submitterId: string | null,
  actorId: string
): Promise<void> {
  return emitEvent({
    workspaceId,
    actorId,
    type: "version_feedback",
    subjectType: "asset_version",
    subjectId: versionId,
    recipientIds: submitterId ? [submitterId] : [],
  })
}

/**
 * A decision pinned to a version (FR-032..035, FR-047f). The submitter hears
 * approved / rejected / changes-requested as three event types, because the
 * inbox copy (and the icon) should say which.
 */
export function notifySubmitterOfDecision(
  workspaceId: string,
  versionId: string,
  submitterId: string | null,
  actorId: string,
  decision: "approved" | "rejected" | "changes_requested"
): Promise<void> {
  return emitEvent({
    workspaceId,
    actorId,
    type:
      decision === "approved"
        ? "version_review_approved"
        : decision === "rejected"
          ? "version_review_rejected"
          : "version_review_changes_requested",
    subjectType: "asset_version",
    subjectId: versionId,
    recipientIds: submitterId ? [submitterId] : [],
  })
}

// ---------------------------------------------------------------------------
// Inbox reads
// ---------------------------------------------------------------------------

export interface NotificationActor {
  /** The account the tint seeds with — the same colour the person gets everywhere. */
  id: string | null
  name: string | null
  email: string | null
  image: string | null
}

export interface NotificationItem {
  id: string
  type: string
  subjectType: string
  subjectId: string
  /** Precomposed inbox copy — the pure mapping in `notification-events`. */
  message: string
  /** The same copy as segments, so the styled inbox can bold the actor's name. */
  messageParts: NotificationCopyPart[]
  actor: NotificationActor
  /** The subject's project, when a concrete project page exists for it. */
  projectSlug: string | null
  /** Task title / filename / project title the copy points at. */
  subjectLabel: string | null
  readAt: Date | null
  createdAt: Date
}

interface SubjectRow {
  label: string
  projectSlug: string | null
}

/**
 * The freshest inbox rows for one user inside one workspace. Subjects are
 * resolved polymorphically after the row fetch — one bounded lookup per
 * subject type, so the list stays four cheap `IN` queries however mixed the
 * events are. Gone subjects (a trashed project, a deleted task) degrade to
 * the neutral copy, not an error.
 */
export async function listNotifications(
  workspaceId: string,
  userId: string
): Promise<NotificationItem[]> {
  const rows = await db
    .select({
      id: notifications.id,
      type: notifications.type,
      subjectType: notifications.subjectType,
      subjectId: notifications.subjectId,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
      actorId: notifications.actorId,
      actorName: user.name,
      actorEmail: user.email,
      actorImage: user.image,
    })
    .from(notifications)
    .leftJoin(user, eq(notifications.actorId, user.id))
    .where(
      and(
        eq(notifications.workspaceId, workspaceId),
        eq(notifications.userId, userId)
      )
    )
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(INBOX_LIMIT)

  if (rows.length === 0) return []

  const idsOfType = (type: NotificationSubjectType) =>
    rows.filter((row) => row.subjectType === type).map((row) => row.subjectId)

  const projectIds = idsOfType("project")
  const deliverableIds = idsOfType("deliverable")
  const taskIds = idsOfType("task")
  const versionIds = idsOfType("asset_version")

  const [projectRows, deliverableRows, taskRows, versionRows] =
    await Promise.all([
      projectIds.length > 0
        ? db
            .select({
              id: projects.id,
              slug: projects.slug,
              title: projects.title,
            })
            .from(projects)
            .where(
              and(
                eq(projects.workspaceId, workspaceId),
                inArray(projects.id, projectIds)
              )
            )
        : Promise.resolve([]),
      deliverableIds.length > 0
        ? db
            .select({
              id: deliverables.id,
              title: deliverables.title,
              projectSlug: projects.slug,
            })
            .from(deliverables)
            .innerJoin(projects, eq(deliverables.projectId, projects.id))
            .where(
              and(
                eq(deliverables.workspaceId, workspaceId),
                inArray(deliverables.id, deliverableIds)
              )
            )
        : Promise.resolve([]),
      taskIds.length > 0
        ? db
            .select({
              id: tasks.id,
              title: tasks.title,
              projectSlug: projects.slug,
            })
            .from(tasks)
            .innerJoin(projects, eq(tasks.projectId, projects.id))
            .where(
              and(
                eq(projects.workspaceId, workspaceId),
                inArray(tasks.id, taskIds)
              )
            )
        : Promise.resolve([]),
      versionIds.length > 0
        ? db
            .select({
              id: assetVersions.id,
              filename: assets.filename,
              label: assetVersions.label,
              projectSlug: projects.slug,
            })
            .from(assetVersions)
            .innerJoin(assets, eq(assetVersions.assetId, assets.id))
            .innerJoin(projects, eq(assets.projectId, projects.id))
            .where(
              and(
                eq(projects.workspaceId, workspaceId),
                inArray(assetVersions.id, versionIds)
              )
            )
        : Promise.resolve([]),
    ])

  const subjectById = new Map<string, SubjectRow>()
  for (const row of projectRows) {
    subjectById.set(row.id, { label: row.title, projectSlug: row.slug })
  }
  for (const row of deliverableRows) {
    subjectById.set(row.id, { label: row.title, projectSlug: row.projectSlug })
  }
  for (const row of taskRows) {
    subjectById.set(row.id, { label: row.title, projectSlug: row.projectSlug })
  }
  for (const row of versionRows) {
    // "brief-final.mov (v3)" — the file is the identity, the label the cut.
    subjectById.set(row.id, {
      label: `${row.filename} (${row.label})`,
      projectSlug: row.projectSlug,
    })
  }

  return rows.map((row) => {
    const subject = subjectById.get(row.subjectId) ?? null
    const copy = describeNotification(
      row.type,
      row.subjectType,
      row.actorName,
      subject?.label ?? null
    )
    return {
      id: row.id,
      type: row.type,
      subjectType: row.subjectType,
      subjectId: row.subjectId,
      message: copy.message,
      messageParts: copy.parts,
      actor: {
        id: row.actorId,
        name: row.actorName,
        email: row.actorEmail,
        image: row.actorImage,
      },
      projectSlug: subject?.projectSlug ?? null,
      subjectLabel: subject?.label ?? null,
      readAt: row.readAt,
      createdAt: row.createdAt,
    }
  })
}

/** How many of the viewer's bells in this workspace are still ringing. */
export async function countUnread(
  workspaceId: string,
  userId: string
): Promise<number> {
  const rows = await db
    .select({ value: count() })
    .from(notifications)
    .where(
      and(
        eq(notifications.workspaceId, workspaceId),
        eq(notifications.userId, userId),
        isNull(notifications.readAt)
      )
    )
  return rows[0]?.value ?? 0
}

/** Marks one row read for its owner only; other users' rows are out of reach. */
export async function markNotificationRead(
  workspaceId: string,
  userId: string,
  notificationId: string
): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.workspaceId, workspaceId),
        eq(notifications.userId, userId),
        isNull(notifications.readAt)
      )
    )
}

/** Clears every unread row for the viewer in this workspace. */
export async function markAllNotificationsRead(
  workspaceId: string,
  userId: string
): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.workspaceId, workspaceId),
        eq(notifications.userId, userId),
        isNull(notifications.readAt)
      )
    )
}
