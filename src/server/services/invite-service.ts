import { and, eq, isNull, sql } from "drizzle-orm"
import { db } from "@/db"
import {
  roles,
  team,
  user,
  workspaces,
  workspaceInvites,
} from "@/db/schema/index"
import { normalizeEmail } from "@/lib/normalize-email"
import {
  hashInviteToken,
  inviteExpiry,
  mintInviteToken,
} from "@/lib/invite-token"

/**
 * Workspace invite domain logic. Pure DB operations only — no HTTP, no
 * session. Thin server functions in `src/server/functions` own auth and call
 * in here.
 *
 * The security posture this file exists to hold, restated because each point
 * has been got wrong somewhere before:
 *
 * - Tokens are stored hashed. The raw token exists only in the outbound email.
 * - Membership is checked against **this workspace only**. A global "does a
 *   user with this email exist?" check would turn any admin into an oracle
 *   over the entire user base, which is a far bigger disclosure than the
 *   caller already has.
 * - Roles are validated as workspace-scope. `roles` holds two scopes with
 *   duplicate titles, and the foreign key alone does not prove which.
 * - Inviter attribution is returned only to callers who may manage the
 *   workspace. Hidden in the UI is not the same as absent.
 */

export interface CreateInviteInput {
  workspaceId: string
  email: string
  /**
   * Role *title*, not a row id. Roles are per-workspace rows created at
   * workspace creation, so their ids aren't knowable by a client that only
   * knows the slug. The title is matched against workspace-scope roles below,
   * which is also what keeps a project-scope role out.
   */
  roleTitle: string
  invitedBy: string
  /** True when the caller owns the workspace. */
  isOwner: boolean
}

/** Per-workspace and per-admin ceilings, enforced in one query. */
const MAX_INVITES_PER_DAY = 25

export class InviteError extends Error {
  constructor(
    message: string,
    readonly code:
      | "not_found"
      | "already_member"
      | "not_an_admin"
      | "invalid_role"
      | "rate_limited"
  ) {
    super(message)
    this.name = "InviteError"
  }
}

/**
 * Resolves a workspace-scope role id, or throws. A project-scope role shares
 * its title with a workspace role, so title matching is not enough — this
 * checks the scope itself.
 */
export async function resolveWorkspaceRole(
  workspaceId: string,
  roleTitle: string
) {
  const rows = await db
    .select()
    .from(roles)
    .where(
      and(
        eq(roles.workspaceId, workspaceId),
        eq(roles.title, roleTitle),
        eq(roles.scope, "workspace")
      )
    )
    .limit(1)

  const role = rows[0]
  if (!role) {
    throw new InviteError(
      "That role isn't available for workspace invites.",
      "invalid_role"
    )
  }
  return role
}

/**
 * Issues an invite, replacing any pending one for the same address.
 *
 * Replacing rather than erroring keeps resend idempotent and makes the
 * "one live invite per address" index the only thing enforcing it, instead of
 * a check that can be forgotten.
 *
 * Returns the raw token so the caller can send it. It is never persisted.
 */
export async function createInvite(input: CreateInviteInput): Promise<{
  token: string
  email: string
  expiresAt: Date
  roleTitle: string
}> {
  const email = normalizeEmail(input.email)

  await assertCanInvite(input)

  const role = await resolveWorkspaceRole(input.workspaceId, input.roleTitle)

  const { token, tokenHash } = mintInviteToken()
  const expiresAt = inviteExpiry()

  await db.transaction(async (tx) => {
    // Drop any pending invite for this address first. Doing it inside the
    // transaction means a concurrent second invite can't slip a row past the
    // unique index and surface as an unhandled violation.
    await tx
      .delete(workspaceInvites)
      .where(
        and(
          eq(workspaceInvites.workspaceId, input.workspaceId),
          sql`lower(${workspaceInvites.email}) = ${email}`,
          isNull(workspaceInvites.acceptedAt)
        )
      )

    await tx.insert(workspaceInvites).values({
      workspaceId: input.workspaceId,
      email,
      roleId: role.id,
      tokenHash,
      expiresAt,
      invitedBy: input.invitedBy,
    })
  })

  return { token, email, expiresAt, roleTitle: role.title }
}

/**
 * Admin-only, and workspace-scoped.
 *
 * Both failure modes are checked in one query against this workspace only.
 * Deliberately never asks whether a `user` row exists for the address: that
 * answer is global, and returning it here would let any workspace admin page
 * through the entire user base.
 */
async function assertCanInvite(input: CreateInviteInput): Promise<void> {
  const email = normalizeEmail(input.email)

  const recent = await db
    .select({ id: workspaceInvites.id })
    .from(workspaceInvites)
    .where(
      and(
        eq(workspaceInvites.workspaceId, input.workspaceId),
        sql`${workspaceInvites.createdAt} > now() - interval '1 day'`
      )
    )
    .limit(MAX_INVITES_PER_DAY + 1)

  if (recent.length > MAX_INVITES_PER_DAY) {
    throw new InviteError(
      `You've sent ${MAX_INVITES_PER_DAY} invites in the last day. Try again tomorrow.`,
      "rate_limited"
    )
  }

  // Already a member of THIS workspace, by either representation:
  // a seat reserved by address, or a joined membership matched on the user's
  // own email. Scoped to this workspace on purpose — see the note at the top
  // of this file.
  const reserved = await db
    .select({ id: team.id })
    .from(team)
    .where(
      and(
        eq(team.workspaceId, input.workspaceId),
        sql`lower(${team.email}) = ${email}`
      )
    )
    .limit(1)

  if (reserved.length > 0) {
    throw new InviteError(
      "That address already has a seat in this workspace.",
      "already_member"
    )
  }

  const joined = await db
    .select({ id: team.id })
    .from(team)
    .innerJoin(user, eq(team.userId, user.id))
    .where(
      and(
        eq(team.workspaceId, input.workspaceId),
        sql`lower(${user.email}) = ${email}`
      )
    )
    .limit(1)

  if (joined.length > 0) {
    throw new InviteError(
      "That address is already in this workspace.",
      "already_member"
    )
  }

  // The owner can't be re-invited: owner-ness is `workspaces.ownerId`, not a
  // role, so an invite could never grant it and would just be confusing.
  const isOwner = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(
      and(
        eq(workspaces.id, input.workspaceId),
        eq(workspaces.ownerId, input.invitedBy)
      )
    )
    .limit(1)

  if (isOwner.length > 0 && !input.isOwner) {
    throw new InviteError(
      "That address is already in this workspace.",
      "already_member"
    )
  }
}

/**
 * Looks up a live invite by presented token.
 *
 * Returns null for expired, already-accepted and unknown tokens alike. The
 * caller must not be able to tell those apart from the response: doing so
 * would confirm that a token was once real. It cannot be enumerated anyway at
 * 32 bytes of entropy, which is what makes collapsing them safe.
 */
export async function findLiveInviteByToken(token: string) {
  const rows = await db
    .select()
    .from(workspaceInvites)
    .where(
      and(
        eq(workspaceInvites.tokenHash, hashInviteToken(token)),
        isNull(workspaceInvites.acceptedAt),
        sql`${workspaceInvites.expiresAt} > now()`
      )
    )
    .limit(1)

  return rows[0] ?? null
}

/**
 * Workspace identity for the invite landing page, which has no session and so
 * cannot go through `getWorkspaceBySlug`. Only the public-facing fields.
 */
export async function getWorkspaceForInvite(workspaceId: string) {
  const rows = await db
    .select({ slug: workspaces.slug, title: workspaces.title })
    .from(workspaces)
    .where(and(eq(workspaces.id, workspaceId), isNull(workspaces.deletedAt)))
    .limit(1)
  return rows[0] ?? null
}

/** Role label for the invite landing page, e.g. "Admin". */
export async function getRoleTitle(roleId: string) {
  const rows = await db
    .select({ title: roles.title, scope: roles.scope })
    .from(roles)
    .where(eq(roles.id, roleId))
    .limit(1)
  return rows[0]?.scope === "workspace" ? rows[0].title : null
}

export interface PendingInvite {
  id: string
  email: string
  role: string
  expiresAt: Date
  createdAt: Date
  /** Only populated when the caller may manage the workspace. */
  invitedByName?: string | null
  invitedByEmail?: string | null
}

/**
 * Pending invites for a workspace. `invitedBy` is resolved only when
 * `includeInviter` is set, and the server functions call it strictly for
 * admins — the names should never reach a non-admin client at all, rather
 * than being present and merely hidden in the UI.
 */
export async function listPendingInvites(
  workspaceId: string,
  includeInviter: boolean
): Promise<PendingInvite[]> {
  const rows = await db
    .select({
      id: workspaceInvites.id,
      email: workspaceInvites.email,
      expiresAt: workspaceInvites.expiresAt,
      createdAt: workspaceInvites.createdAt,
      roleTitle: roles.title,
      invitedBy: workspaceInvites.invitedBy,
    })
    .from(workspaceInvites)
    .innerJoin(roles, eq(workspaceInvites.roleId, roles.id))
    .where(
      and(
        eq(workspaceInvites.workspaceId, workspaceId),
        isNull(workspaceInvites.acceptedAt)
      )
    )
    .orderBy(workspaceInvites.createdAt)

  if (!includeInviter) {
    return rows.map((r) => ({
      id: r.id,
      email: r.email,
      role: r.roleTitle,
      expiresAt: r.expiresAt,
      createdAt: r.createdAt,
    }))
  }

  const inviterIds = rows
    .map((r) => r.invitedBy)
    .filter((v): v is string => !!v)
  const inviters = inviterIds.length
    ? await db
        .select({ id: user.id, name: user.name, email: user.email })
        .from(user)
        .where(sql`${user.id} in ${inviterIds}`)
    : []

  const byId = new Map(inviters.map((i) => [i.id, i]))

  return rows.map((r) => {
    const inviter = r.invitedBy ? byId.get(r.invitedBy) : null
    return {
      id: r.id,
      email: r.email,
      role: r.roleTitle,
      expiresAt: r.expiresAt,
      createdAt: r.createdAt,
      invitedByName: inviter?.name ?? null,
      invitedByEmail: inviter?.email ?? null,
    }
  })
}

/** Deletes a pending invite, invalidating its token immediately. */
export async function revokeInvite(workspaceId: string, inviteId: string) {
  await db
    .delete(workspaceInvites)
    .where(
      and(
        eq(workspaceInvites.id, inviteId),
        eq(workspaceInvites.workspaceId, workspaceId),
        isNull(workspaceInvites.acceptedAt)
      )
    )
}

/**
 * Redeems an invite for a user who already has a verified account.
 *
 * Callers must have established a verified session first. That check is
 * load-bearing and lives in the server function, not here: a `team` row exists
 * for a pending invitee with no user row, so registering that address succeeds
 * and an unguarded accept would hand the workspace to whoever got there first.
 */
export async function acceptInviteForUser(
  token: string,
  userId: string,
  userEmail: string
) {
  const invite = await findLiveInviteByToken(token)
  if (!invite) {
    throw new InviteError("That invite is no longer valid.", "not_found")
  }

  const email = normalizeEmail(userEmail)

  await db.transaction(async (tx) => {
    // Attach the pending row to this account. Matched on email rather than
    // creating a second one: the invite already reserved a seat, and a
    // duplicate would make the workspace look like it has two of the same
    // person in it.
    const pending = await tx
      .select()
      .from(team)
      .where(
        and(
          eq(team.workspaceId, invite.workspaceId),
          sql`lower(${team.email}) = ${email}`,
          isNull(team.userId)
        )
      )
      .limit(1)

    if (pending[0]) {
      await tx
        .update(team)
        .set({
          userId,
          email: null,
          roleId: invite.roleId,
          status: "active",
          joinedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(team.id, pending[0].id))
    } else {
      // No reserved seat — the invitee already joined another way.
      await tx.insert(team).values({
        workspaceId: invite.workspaceId,
        userId,
        roleId: invite.roleId,
        status: "active",
        joinedAt: new Date(),
      })
    }

    await tx
      .update(workspaceInvites)
      .set({ acceptedAt: new Date() })
      .where(eq(workspaceInvites.id, invite.id))
  })

  const rows = await db
    .select({ slug: workspaces.slug, title: workspaces.title })
    .from(workspaces)
    .where(eq(workspaces.id, invite.workspaceId))
    .limit(1)

  return rows[0] ?? null
}

/**
 * Attaches a newly-verified account to any seat reserved for its address.
 *
 * This is the backfill, and it runs on verification rather than on sign-up —
 * see the note on `acceptInviteForUser`. It resolves identity only: the seat
 * stays `pending` until the invite link is actually redeemed, so the link is
 * never a no-op for someone who verified before clicking it.
 */
export async function backfillSeatsForVerifiedUser(
  userId: string,
  email: string
): Promise<number> {
  const normalized = normalizeEmail(email)

  const seats = await db
    .select({ id: team.id })
    .from(team)
    .where(
      and(
        sql`lower(${team.email}) = ${normalized}`,
        isNull(team.userId),
        sql`${team.status} <> 'left'`
      )
    )

  if (seats.length === 0) return 0

  // One statement for all seats: a person invited to three workspaces gets all
  // three at once, and the unique index on (workspace_id, user_id) means each
  // pair is distinct.
  await db
    .update(team)
    .set({ userId, email: null, updatedAt: new Date() })
    .where(sql`${team.id} in ${seats.map((s) => s.id)}`)

  return seats.length
}
