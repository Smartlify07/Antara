import { and, asc, count, desc, eq, inArray, isNull } from "drizzle-orm"
import { db } from "@/db"
import type {
  ProjectStatus,
  RequestTriageStatus,
  TaskPriority,
} from "@/db/enums"
import { user } from "@/db/schema/auth"
import { comments } from "@/db/schema/comments"
import { requests } from "@/db/schema/requests"
import { projects } from "@/db/schema/projects"
import { slugifyTitle } from "@/lib/project-schemas"
import { requireWorkspaceAccess } from "@/server/services/access-service"
import {
  createProject,
  isSlugAvailableInWorkspace,
} from "@/server/services/project-service"
import { assertRequestTriageTransition } from "@/server/services/workflow-states"
import { canTriage } from "@/server/services/request-permissions"

// Re-exported so callers have one import surface (see request-permissions).
export {
  canPostOnRequest,
  canTriage,
} from "@/server/services/request-permissions"
export { requireWorkspaceAccess } from "@/server/services/access-service"

/**
 * The Requests module's brain (FR-006..011).
 *
 * Permission envelope, per the plan's rules, resolved through
 * `access-service`:
 * - every workspace member may submit, read, and post on the brief thread;
 * - only workspace admins or leads may triage: needs-info, decline, and
 *   accept-into-a-project.
 */

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export interface RequestListItem {
  id: string
  title: string
  brief: string
  triageStatus: RequestTriageStatus
  category: string | null
  priority: TaskPriority | null
  desiredDeadline: Date | null
  createdAt: Date
  referenceLinks: string[] | null
  /** The requester's user id — the seed the team page uses for avatar tints. */
  requesterId: string | null
  requesterName: string | null
  requesterImage: string | null
  linkedProjectId: string | null
  linkedProjectTitle: string | null
  linkedProjectSlug: string | null
  messageCount: number
}

/**
 * The card shape. Shared by the inbox query and the single-request query so
 * the list and the detail render identical summaries (dual words for dual
 * surfaces was how the project list and project detail disagreed, once).
 */
const requestCard = {
  id: requests.id,
  title: requests.title,
  brief: requests.brief,
  triageStatus: requests.triageStatus,
  category: requests.category,
  priority: requests.priority,
  desiredDeadline: requests.desiredDeadline,
  createdAt: requests.createdAt,
  referenceLinks: requests.referenceLinks,
  requesterId: user.id,
  requesterName: user.name,
  requesterImage: user.image,
  linkedProjectId: projects.id,
  linkedProjectTitle: projects.title,
  linkedProjectSlug: projects.slug,
  messageCount: count(comments.id),
}

const requestCardGroupBy = [
  requests.id,
  user.id,
  user.name,
  user.image,
  projects.id,
  projects.title,
  projects.slug,
]

type RequestCardRow = Awaited<ReturnType<typeof baseRequestCardQuery>>[number]

function toListItem(row: RequestCardRow): RequestListItem {
  return { ...row, messageCount: Number(row.messageCount) }
}

/**
 * The card join. Factored once so the list and the single-request reads can
 * never disagree on shape (that disagreement is what RequestCardRow types
 * off), and so a column change is made in exactly one place.
 */
function baseRequestCardQuery() {
  return db
    .select(requestCard)
    .from(requests)
    .leftJoin(user, eq(requests.requesterId, user.id))
    .leftJoin(projects, eq(requests.projectId, projects.id))
    .leftJoin(
      comments,
      and(
        eq(comments.subjectId, requests.id),
        eq(comments.subjectType, "request")
      )
    )
}

/** The inbox: every request in the workspace, newest first. */
export async function listRequests(
  workspaceId: string
): Promise<RequestListItem[]> {
  const rows = await baseRequestCardQuery()
    .where(eq(requests.workspaceId, workspaceId))
    .groupBy(...requestCardGroupBy)
    .orderBy(desc(requests.createdAt))
  return rows.map(toListItem)
}

/** One card by id, or null when the id belongs to another workspace. */
async function loadRequestCard(workspaceId: string, requestId: string) {
  const rows = await baseRequestCardQuery()
    .where(
      and(eq(requests.workspaceId, workspaceId), eq(requests.id, requestId))
    )
    .groupBy(...requestCardGroupBy)
  const row = rows[0]
  return row ? toListItem(row) : null
}

/** The detail page's card (the thread is a separate query — see below). */
export async function getRequest(
  workspaceId: string,
  requestId: string
): Promise<RequestListItem | null> {
  return loadRequestCard(workspaceId, requestId)
}

export interface RequestThreadMessage {
  id: string
  authorId: string | null
  authorName: string | null
  authorImage: string | null
  body: string
  createdAt: Date
}

/**
 * One polymorphic subject read: `subject_type=request` rows only, oldest
 * first, so the thread reads like a conversation.
 */
export async function listRequestThread(
  workspaceId: string,
  requestId: string
): Promise<RequestThreadMessage[]> {
  return db
    .select({
      id: comments.id,
      authorId: comments.authorId,
      authorName: user.name,
      authorImage: user.image,
      body: comments.body,
      createdAt: comments.createdAt,
    })
    .from(comments)
    .leftJoin(user, eq(comments.authorId, user.id))
    .where(
      and(
        eq(comments.workspaceId, workspaceId),
        eq(comments.subjectType, "request"),
        eq(comments.subjectId, requestId)
      )
    )
    .orderBy(asc(comments.createdAt), asc(comments.id))
}

/** The sidebar badge number: everything still in either pre-triage state. */
export async function countPendingRequests(
  workspaceId: string
): Promise<number> {
  const rows = await db
    .select({ value: count() })
    .from(requests)
    .where(
      and(
        eq(requests.workspaceId, workspaceId),
        inArray(requests.triageStatus, ["open", "needs_info"])
      )
    )
  return Number(rows[0]?.value ?? 0)
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export interface SubmitRequestPayload {
  title: string
  brief: string
  category?: string
  priority?: TaskPriority
  desiredDeadline?: string
  referenceLinks?: string[]
}

export async function createRequest(
  workspaceId: string,
  requesterId: string,
  payload: SubmitRequestPayload
): Promise<string> {
  const createdRows = await db
    .insert(requests)
    .values({
      workspaceId,
      requesterId,
      title: payload.title,
      brief: payload.brief,
      category: payload.category ?? null,
      priority: payload.priority ?? null,
      desiredDeadline: payload.desiredDeadline
        ? new Date(payload.desiredDeadline)
        : null,
      referenceLinks: payload.referenceLinks?.length
        ? payload.referenceLinks
        : null,
    })
    .returning({ id: requests.id })
  const created = createdRows[0]
  if (!created) throw new Error("Could not save the request.")
  return created.id
}

/** Post on the brief thread. Any workspace member; no triage rights needed. */
export async function addRequestMessage(
  workspaceId: string,
  authorId: string,
  requestId: string,
  body: string
): Promise<void> {
  await requireWorkspaceAccess(workspaceId, authorId)
  const request = (
    await db
      .select({ id: requests.id })
      .from(requests)
      .where(
        and(eq(requests.workspaceId, workspaceId), eq(requests.id, requestId))
      )
      .limit(1)
  )[0]
  if (!request) throw new Error("Request not found.")
  await insertComment(workspaceId, authorId, requestId, body)
}

async function insertComment(
  workspaceId: string,
  authorId: string,
  requestId: string,
  body: string
): Promise<void> {
  await db.insert(comments).values({
    workspaceId,
    authorId,
    subjectType: "request",
    subjectId: requestId,
    body,
  })
}

export interface TriageOutcome {
  status: RequestTriageStatus
  projectId: string | null
}

/**
 * The single triage write. Every path shares the same skeleton:
 * 1. membership check (admin/lead),
 * 2. the request must exist in THIS workspace,
 * 3. the transition must be legal per the state machine,
 * 4. the UPDATE carries its own WHERE `triage_status = <from>` so two
 *    triagers clicking in race produce one winner and one clear error,
 * 5. the decision is stamped onto the brief thread — the comment history is
 *    the audit trail behind whatever status shows today.
 *
 * `projectId` is passed only by accept; decline/needs-info never rewrite it.
 */
async function recordTriage(
  workspaceId: string,
  actorId: string,
  requestId: string,
  target: "accepted" | "needs_info" | "declined",
  message: string,
  linkProjectId?: string
): Promise<TriageOutcome> {
  const access = await requireWorkspaceAccess(workspaceId, actorId)
  if (!canTriage(access)) {
    throw new Error("Only workspace admins or leads can triage requests.")
  }

  const from = await loadRequestStatus(workspaceId, requestId)
  if (!from) throw new Error("Request not found.")
  assertRequestTriageTransition(from.status, target)

  const updates: {
    triageStatus: RequestTriageStatus
    projectId?: string | null
    updatedAt: Date
  } = { triageStatus: target, updatedAt: new Date() }
  if (target === "accepted") updates.projectId = linkProjectId ?? null

  const updatedRows = await db
    .update(requests)
    .set(updates)
    .where(
      and(eq(requests.id, requestId), eq(requests.triageStatus, from.status))
    )
    .returning({ projectId: requests.projectId })
  const updated = updatedRows[0]

  if (!updated) {
    throw new Error(
      "This request was just triaged by someone else. Refresh and try again."
    )
  }

  await insertComment(workspaceId, actorId, requestId, message)
  return { status: target, projectId: updated.projectId ?? null }
}

async function loadRequestStatus(workspaceId: string, requestId: string) {
  const rows = await db
    .select({ status: requests.triageStatus })
    .from(requests)
    .where(
      and(eq(requests.workspaceId, workspaceId), eq(requests.id, requestId))
    )
    .limit(1)
  return rows[0] ?? null
}

/**
 * needs-info without a message fails the FR by definition: "request
 * additional information" IS the message. Card, schema, and this guard agree.
 */
export async function requestNeedsInfo(
  workspaceId: string,
  actorId: string,
  requestId: string,
  message: string
): Promise<TriageOutcome> {
  if (!message.trim()) {
    throw new Error("Needs-info has to actually ask for something.")
  }
  return recordTriage(workspaceId, actorId, requestId, "needs_info", message)
}

export async function declineRequest(
  workspaceId: string,
  actorId: string,
  requestId: string,
  reason?: string
): Promise<TriageOutcome> {
  return recordTriage(
    workspaceId,
    actorId,
    requestId,
    "declined",
    reason?.trim() || "Request declined."
  )
}

/**
 * accept-into-a-project: link an existing one, or mint a new one in the same
 * breath. The project, not the request, becomes the work surface — this call
 * wires the two together and stamps the audit trail.
 *
 * Permission is checked HERE, before any project write: a non-triager must
 * not be able to mint projects by just calling the accept path.
 */
export async function acceptRequest(
  workspaceId: string,
  actorId: string,
  requestId: string,
  destination:
    | { projectId: string }
    | { newProjectTitle: string; newProjectDescription?: string },
  message?: string
): Promise<TriageOutcome> {
  const access = await requireWorkspaceAccess(workspaceId, actorId)
  if (!canTriage(access)) {
    throw new Error("Only workspace admins or leads can triage requests.")
  }

  let projectId: string
  if ("projectId" in destination) {
    // The linked project must be a live project of the SAME workspace — an id
    // from a different workspace, or a deleted one, must never attach.
    const project = (
      await db
        .select({ id: projects.id })
        .from(projects)
        .where(
          and(
            eq(projects.id, destination.projectId),
            eq(projects.workspaceId, workspaceId),
            isNull(projects.deletedAt)
          )
        )
        .limit(1)
    )[0]
    if (!project)
      throw new Error("That project does not exist in this workspace.")
    projectId = project.id
  } else {
    const base = slugifyTitle(destination.newProjectTitle)
    let candidate = base
    for (let attempt = 1; attempt <= 25; attempt++) {
      if (await isSlugAvailableInWorkspace(workspaceId, candidate)) break
      candidate = `${base}-${attempt + 1}`
    }

    const created = await createProject(workspaceId, candidate, {
      title: destination.newProjectTitle,
      description: destination.newProjectDescription ?? null,
      // Work is ahead, deliverables are not yet — planning is the honest state.
      status: "planning" satisfies ProjectStatus,
      memberTeamIds: [],
      leadTeamId: null,
      tagIds: [],
      newTagLabels: [],
      ownerUserId: actorId,
    })
    projectId = created.id
  }

  return recordTriage(
    workspaceId,
    actorId,
    requestId,
    "accepted",
    message?.trim() || "Request accepted.",
    projectId
  )
}
