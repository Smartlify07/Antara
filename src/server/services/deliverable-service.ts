import { and, asc, count, eq, isNotNull, isNull, sql } from "drizzle-orm"
import { db } from "@/db"
import { user } from "@/db/schema/auth"
import { assetVersions, assets } from "@/db/schema/assets"
import { comments } from "@/db/schema/comments"
import { deliverables } from "@/db/schema/deliverables"
import { requests } from "@/db/schema/requests"
import { projects } from "@/db/schema/projects"
import { team } from "@/db/schema/workspaces"
import type {
  CreateDeliverableInput,
  DeliverableCommentInput,
  SetDeliverableDeadlineInput,
  SetDeliverableOwnerInput,
} from "@/lib/deliverable-schemas"
import type { DeliverableStatus } from "@/db/enums"
import { assertDeliverableTransition } from "./workflow-states"
import { notifyDeliverableOwnerAssigned } from "./notification-service"
import {
  canManageDeliverables,
  canMoveProductionStatus,
  canWorkOnTasks,
} from "./work-permissions"
import { requireWorkAccess } from "./work-access"

/**
 * The deliverable service (FR-013..015, 017). A project's work unit: owner
 * (`team` membership), deadline, production state — each card independent of
 * its siblings, and every state move pressed through the workflow machine in
 * `workflow-states.ts`.
 */

/** A date-only wire value ("2026-02-01") pinned to UTC midnight. */
function parseDayDate(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) {
    throw new Error("That date could not be read.")
  }
  return date
}

interface RequestRef {
  id: string
  title: string
}

export interface DeliverableCard {
  id: string
  title: string
  description: string | null
  type: string | null
  status: DeliverableStatus
  /** Date-only string; calendar dates render without timezone surprises. */
  deadline: string | null
  /** Server-computed so every surface agrees on what "late" means. */
  overdue: boolean
  owner: {
    teamId: string
    name: string | null
    email: string | null
    image: string | null
  } | null
  /** The accepted request this work came from, when it did. */
  request: RequestRef | null
  /** Versions recorded across the deliverable's assets — the Work tab's
   * Versions expander shows the count before fetching the timeline. */
  versionCount: number
  /** May reassign owner / set the deadline (admin or project lead). */
  viewerCanManage: boolean
  /** May press the production-status chip (admin, lead, or the owner). */
  viewerCanMove: boolean
}

/** Today's calendar date in UTC — the same "day" line the client themes. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function isoDayOrNull(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null
}

async function requireLiveProject(
  workspaceId: string,
  projectId: string
): Promise<void> {
  const rows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(
        eq(projects.id, projectId),
        eq(projects.workspaceId, workspaceId),
        isNull(projects.deletedAt)
      )
    )
    .limit(1)
  if (rows.length === 0) throw new Error("Project not found.")
}

/** Reads the owner's membership resolved back to a `team`/`user` pair. */
function ownerSelect() {
  return {
    teamId: team.id,
    ownerName: user.name,
    ownerEmail: user.email,
    ownerImage: user.image,
  }
}

export async function listProjectDeliverables(
  workspaceId: string,
  userId: string,
  projectId: string
): Promise<{
  deliverables: DeliverableCard[]
  viewer: { canManage: boolean }
}> {
  const access = await requireWorkAccess(workspaceId, userId, projectId)

  const rows = await db
    .select({
      id: deliverables.id,
      title: deliverables.title,
      description: deliverables.description,
      type: deliverables.type,
      status: deliverables.productionStatus,
      deadline: deliverables.deadline,
      ownerId: deliverables.ownerId,
      requestId: requests.id,
      requestTitle: requests.title,
      ...ownerSelect(),
    })
    .from(deliverables)
    .leftJoin(
      team,
      and(eq(team.id, deliverables.ownerId), eq(team.status, "active"))
    )
    .leftJoin(user, eq(team.userId, user.id))
    .leftJoin(requests, eq(requests.id, deliverables.requestId))
    .where(eq(deliverables.projectId, projectId))
    // Soonest deadline first, undated within that; deterministic tiebreak.
    .orderBy(
      sql`${deliverables.deadline} ASC NULLS LAST`,
      asc(deliverables.createdAt)
    )

  const today = todayIso()

  // One cheap count per deliverable so every card can promise a Versions
  // expander without fetching its whole timeline.
  const versionCounts = await db
    .select({
      deliverableId: assets.deliverableId,
      value: count(assetVersions.id),
    })
    .from(assets)
    .innerJoin(assetVersions, eq(assetVersions.assetId, assets.id))
    .where(
      and(eq(assets.projectId, projectId), isNotNull(assets.deliverableId))
    )
    .groupBy(assets.deliverableId)
  const versionCountByDeliverable = new Map(
    versionCounts.map((row) => [row.deliverableId, row.value])
  )

  const cards: DeliverableCard[] = rows.map((row) => {
    const deadline = isoDayOrNull(row.deadline)
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      type: row.type,
      status: row.status,
      deadline,
      versionCount: versionCountByDeliverable.get(row.id) ?? 0,
      overdue:
        deadline !== null && deadline < today && row.status !== "completed",
      owner: row.teamId
        ? {
            teamId: row.teamId,
            name: row.ownerName,
            email: row.ownerEmail,
            image: row.ownerImage,
          }
        : null,
      request:
        row.requestId && row.requestTitle
          ? { id: row.requestId, title: row.requestTitle }
          : null,
      viewerCanManage: canManageDeliverables(access.facts),
      viewerCanMove: canMoveProductionStatus(access.facts, row.ownerId),
    }
  })

  // The create/edit authority is a viewer fact, not a row fact — critical in
  // the empty state, where the rows otherwise imply "nobody may manage".
  return {
    deliverables: cards,
    viewer: { canManage: canManageDeliverables(access.facts) },
  }
}

/**
 * Creates the deliverable. Owner and deadline are optional — a card can land
 * as "planned and unowned" and be filled in after triage shapes the work.
 */
export async function createDeliverable(
  workspaceId: string,
  userId: string,
  input: CreateDeliverableInput
): Promise<{ id: string }> {
  const access = await requireWorkAccess(workspaceId, userId, input.projectId)
  if (!canManageDeliverables(access.facts)) {
    throw new Error(
      "Only project leads or workspace admins can create deliverables."
    )
  }
  await requireLiveProject(workspaceId, input.projectId)

  if (input.ownerId) {
    await requireTeamMember(workspaceId, input.ownerId)
  }

  const createdRows = await db
    .insert(deliverables)
    .values({
      workspaceId,
      projectId: input.projectId,
      title: input.title,
      description: input.description ?? null,
      type: input.type ?? null,
      ownerId: input.ownerId ?? null,
      deadline: input.deadline ? parseDayDate(input.deadline) : null,
      createdBy: userId,
    })
    .returning({ id: deliverables.id })
  if (createdRows.length === 0)
    throw new Error("Could not create the deliverable.")

  // The owner hears about the work they now carry (FR-047b); fail-soft, so
  // the card's creation never depends on the bell.
  if (input.ownerId) {
    void notifyDeliverableOwnerAssigned(
      workspaceId,
      input.projectId,
      createdRows[0].id,
      userId,
      input.ownerId
    )
  }
  return { id: createdRows[0].id }
}

/** The owner must be an active workspace membership with an account — the
 * owner chip renders the person, so invitees without accounts cannot yet own work. */
async function requireTeamMember(
  workspaceId: string,
  teamId: string
): Promise<void> {
  const rows = await db
    .select({ joinedAt: team.joinedAt })
    .from(team)
    .where(
      and(
        eq(team.id, teamId),
        eq(team.workspaceId, workspaceId),
        eq(team.status, "active")
      )
    )
    .limit(1)
  if (rows.length === 0 || !rows[0].joinedAt) {
    throw new Error("Pick a workspace member who has joined.")
  }
}

async function requireDeliverable(
  workspaceId: string,
  input: { projectId: string; deliverableId: string }
): Promise<{
  ownerId: string | null
  productionStatus: DeliverableStatus
  deadline: Date | null
}> {
  const rows = await db
    .select({
      ownerId: deliverables.ownerId,
      productionStatus: deliverables.productionStatus,
      deadline: deliverables.deadline,
    })
    .from(deliverables)
    .where(
      and(
        eq(deliverables.id, input.deliverableId),
        eq(deliverables.projectId, input.projectId),
        eq(deliverables.workspaceId, workspaceId)
      )
    )
    .limit(1)
  if (rows.length === 0) throw new Error("Deliverable not found.")
  return rows[0]
}

export async function setDeliverableOwner(
  workspaceId: string,
  userId: string,
  input: SetDeliverableOwnerInput
): Promise<void> {
  const access = await requireWorkAccess(workspaceId, userId, input.projectId)
  if (!canManageDeliverables(access.facts)) {
    throw new Error("Only project leads or workspace admins can assign owners.")
  }
  const current = await requireDeliverable(workspaceId, input)
  if (input.ownerId) await requireTeamMember(workspaceId, input.ownerId)
  if (current.ownerId === input.ownerId) return

  await db
    .update(deliverables)
    .set({ ownerId: input.ownerId, updatedAt: new Date() })
    .where(eq(deliverables.id, input.deliverableId))

  // The reassignment rings the new owner's bell (FR-047b) — clearing an
  // owner is not news for anyone, so `input.ownerId` doubles as the gate.
  if (input.ownerId) {
    void notifyDeliverableOwnerAssigned(
      workspaceId,
      input.projectId,
      input.deliverableId,
      userId,
      input.ownerId
    )
  }
}

export async function setDeliverableDeadline(
  workspaceId: string,
  userId: string,
  input: SetDeliverableDeadlineInput
): Promise<void> {
  const access = await requireWorkAccess(workspaceId, userId, input.projectId)
  if (!canManageDeliverables(access.facts)) {
    throw new Error("Only project leads or workspace admins can set deadlines.")
  }
  await requireDeliverable(workspaceId, input)

  await db
    .update(deliverables)
    .set({
      deadline: input.deadline ? parseDayDate(input.deadline) : null,
      updatedAt: new Date(),
    })
    .where(eq(deliverables.id, input.deliverableId))
}

/**
 * Presses a production-status transition. Guarded twice: the machine decides
 * whether the move is legal at all, and the UPDATE carries the current status
 * in its WHERE so two users clicking in race leaves exactly one winner and
 * one clear "refresh" for the other — the `recordTriage` contract.
 */
export async function setDeliverableStatus(
  workspaceId: string,
  userId: string,
  input: {
    workspaceId: string
    projectId: string
    deliverableId: string
    status: DeliverableStatus
  }
): Promise<void> {
  const access = await requireWorkAccess(workspaceId, userId, input.projectId)
  const current = await requireDeliverable(workspaceId, input)
  if (!canMoveProductionStatus(access.facts, current.ownerId)) {
    throw new Error(
      "Only admins, the project lead, or the owner can move this deliverable's status."
    )
  }

  assertDeliverableTransition(current.productionStatus, input.status)

  const moved = await db
    .update(deliverables)
    .set({ productionStatus: input.status, updatedAt: new Date() })
    .where(
      and(
        eq(deliverables.id, input.deliverableId),
        eq(deliverables.productionStatus, current.productionStatus)
      )
    )
    .returning({ id: deliverables.id })

  if (moved.length === 0) {
    throw new Error(
      "This deliverable was just updated — refresh and try again."
    )
  }
}

// ---------------------------------------------------------------------------
// Threads (comments on the deliverable itself, subjectType "deliverable")
// ---------------------------------------------------------------------------

/** One post in the deliverable's conversation, oldest first. */
export interface DeliverableThreadMessage {
  id: string
  body: string
  createdAt: Date
  authorId: string | null
  authorName: string | null
  authorEmail: string | null
}

/** The deliverable's own thread, oldest first. Same access as the card list. */
export async function listDeliverableThread(
  workspaceId: string,
  userId: string,
  input: { projectId: string; deliverableId: string }
): Promise<DeliverableThreadMessage[]> {
  await requireWorkAccess(workspaceId, userId, input.projectId)
  await requireDeliverable(workspaceId, {
    projectId: input.projectId,
    deliverableId: input.deliverableId,
  })

  return db
    .select({
      id: comments.id,
      body: comments.body,
      createdAt: comments.createdAt,
      authorId: comments.authorId,
      authorName: user.name,
      authorEmail: user.email,
    })
    .from(comments)
    .leftJoin(user, eq(comments.authorId, user.id))
    .where(
      and(
        eq(comments.workspaceId, workspaceId),
        eq(comments.subjectType, "deliverable"),
        eq(comments.subjectId, input.deliverableId)
      )
    )
    .orderBy(asc(comments.createdAt))
}

/**
 * A project member posts to the deliverable's thread. The notification
 * inventory has no deliverable-comment event yet — add one there before
 * wiring a bell, the same way every other emitter earned its FR line first.
 */
export async function addDeliverableComment(
  workspaceId: string,
  userId: string,
  input: DeliverableCommentInput
): Promise<void> {
  const access = await requireWorkAccess(workspaceId, userId, input.projectId)
  if (!canWorkOnTasks(access.facts)) {
    throw new Error("Only project members can add to this thread.")
  }
  await requireDeliverable(workspaceId, {
    projectId: input.projectId,
    deliverableId: input.deliverableId,
  })

  await db.insert(comments).values({
    workspaceId,
    authorId: userId,
    subjectType: "deliverable",
    subjectId: input.deliverableId,
    body: input.body,
  })
}
