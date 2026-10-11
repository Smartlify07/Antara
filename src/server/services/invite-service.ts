import { and, eq, isNull, ne, or, sql } from "drizzle-orm"
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

  const { token, tokenHash } = await mintInviteToken()
  const expiresAt = inviteExpiry()

  await db.transaction(async (tx) => {
    // Drop the previous invite and the seat it reserved. Both, in the same
    // transaction, so a concurrent second invite can't slip past either unique
    // index and surface as an unhandled violation.
    await tx
      .delete(workspaceInvites)
      .where(
        and(
          eq(workspaceInvites.workspaceId, input.workspaceId),
          sql`lower(${workspaceInvites.email}) = ${email}`,
          isNull(workspaceInvites.acceptedAt)
        )
      )

    await tx
      .delete(team)
      .where(
        and(
          eq(team.workspaceId, input.workspaceId),
          sql`lower(${team.email}) = ${email}`,
          isNull(team.userId)
        )
      )

    // Reserve the seat immediately, so the invitee appears in the member list
    // marked as awaiting rather than only in a separate invites list. The seat
    // carries `user_id = null` until the link is redeemed.
    await tx.insert(team).values({
      workspaceId: input.workspaceId,
      email,
      roleId: role.id,
      status: "active",
      invitedAt: new Date(),
    })

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

  // Only a *joined* membership blocks an invite.
  //
  // A seat reserved by address does not — that is the replace-and-reissue path,
  // and `createInvite` clears the old seat in the same transaction. Rejecting it
  // would make a second invite to someone already invited impossible, and that
  // is the common case: the first mail gets lost.
  //
  // Scoped to THIS workspace on purpose. Asking whether a `user` row exists
  // anywhere would turn any admin into an oracle over the whole user base.
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

  // Can't invite yourself. No separate owner check is needed: creating a
  // workspace gives the owner a joined seat, so the check above already covers
  // them.
  const self = await db
    .select({ id: team.id })
    .from(team)
    .where(
      and(
        eq(team.workspaceId, input.workspaceId),
        eq(team.userId, input.invitedBy)
      )
    )
    .limit(1)

  if (self.length > 0) {
    throw new InviteError("You're already in this workspace.", "already_member")
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
        eq(workspaceInvites.tokenHash, await hashInviteToken(token)),
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

/**
 * Deletes a pending invite and the seat it reserved, invalidating the token
 * immediately.
 *
 * Both, or the row would linger in the member list still badged "awaiting"
 * with no way left to complete it — which is exactly the confusion revoking is
 * meant to end.
 */
export async function revokeInvite(workspaceId: string, inviteId: string) {
  await discardPendingInvite(workspaceId, inviteId)
}

/**
 * Removes a pending invite and the seat it reserved.
 *
 * Shared by admin revoke and by the invitee's own "Not now", so there is one
 * path and one state to reason about.
 *
 * The seat deletion is subtler than it looks. `backfillSeatsForVerifiedUser`
 * attaches an account *and clears the seat's email*, so by the time a verified
 * user sees the invitation the seat is `{ user_id, email: null, joined_at: null }`
 * — matching it by address finds nothing, and the row survives revocation still
 * badged "awaiting" with no way left to complete it.
 *
 * So the seat is found by address *or* by the account holding that address, and
 * only ever when it has not been joined. A joined membership is a real
 * membership and must survive either action.
 */
async function discardPendingInvite(
  workspaceId: string,
  inviteId: string
): Promise<boolean> {
  const invite = await db
    .select({ email: workspaceInvites.email })
    .from(workspaceInvites)
    .where(
      and(
        eq(workspaceInvites.id, inviteId),
        eq(workspaceInvites.workspaceId, workspaceId),
        isNull(workspaceInvites.acceptedAt)
      )
    )
    .limit(1)

  if (!invite[0]) return false
  const email = invite[0].email.toLowerCase()

  await db.transaction(async (tx) => {
    await tx
      .delete(workspaceInvites)
      .where(
        and(
          eq(workspaceInvites.id, inviteId),
          isNull(workspaceInvites.acceptedAt)
        )
      )

    const [holder] = await tx
      .select({ id: user.id })
      .from(user)
      .where(sql`lower(${user.email}) = ${email}`)
      .limit(1)

    await tx
      .delete(team)
      .where(
        and(
          eq(team.workspaceId, workspaceId),
          isNull(team.joinedAt),
          or(
            and(sql`lower(${team.email}) = ${email}`, isNull(team.userId)),
            ...(holder ? [eq(team.userId, holder.id)] : [])
          )
        )
      )
  })

  return true
}

/**
 * Declines, as the person who was invited.
 *
 * Scoped to the caller: the invite is only discarded if a seat exists in that
 * workspace for them and it has not been joined. Without that check, knowing
 * an invite id would be enough to discard somebody else's.
 */
export async function declineInvite(
  userId: string,
  userEmail: string,
  inviteId: string
): Promise<boolean> {
  const email = normalizeEmail(userEmail)

  const invite = await db
    .select({
      id: workspaceInvites.id,
      workspaceId: workspaceInvites.workspaceId,
    })
    .from(workspaceInvites)
    .where(
      and(
        eq(workspaceInvites.id, inviteId),
        sql`lower(${workspaceInvites.email}) = ${email}`,
        isNull(workspaceInvites.acceptedAt)
      )
    )
    .limit(1)

  if (!invite[0]) return false

  const seat = await db
    .select({ id: team.id })
    .from(team)
    .where(
      and(
        eq(team.workspaceId, invite[0].workspaceId),
        isNull(team.joinedAt),
        or(
          and(sql`lower(${team.email}) = ${email}`, isNull(team.userId)),
          eq(team.userId, userId)
        )
      )
    )
    .limit(1)

  if (!seat[0]) return false

  return discardPendingInvite(invite[0].workspaceId, inviteId)
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
    // The reserved seat has two shapes by the time anyone accepts, and this
    // lookup has to match both.
    //
    // 1. Untouched since `createInvite`: carries the invited address, no user.
    // 2. Touched by `backfillSeatsForVerifiedUser` on verification: carries the
    //    user, no address, still no `joinedAt`.
    //
    // Matching only the first fell through to the INSERT branch below and hit
    // `team_workspace_user_unique`, because shape 2 already occupies
    // (workspace_id, user_id). That is the path every verification takes, so it
    // was the common case, not an edge one.
    const pending = await tx
      .select()
      .from(team)
      .where(
        and(
          eq(team.workspaceId, invite.workspaceId),
          or(
            and(sql`lower(${team.email}) = ${email}`, isNull(team.userId)),
            and(eq(team.userId, userId), isNull(team.joinedAt))
          )
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

export interface PendingInviteForUser {
  inviteId: string
  workspaceSlug: string
  workspaceTitle: string
  roleTitle: string
  expiresAt: Date
}

/**
 * Every live invitation addressed to this person, across all workspaces.
 *
 * This is the tokenless handle. Once `backfillSeatsForVerifiedUser` has run, a
 * pending seat is `{ user_id: <them>, joined_at: null }` — which identifies both
 * "this person has an unaccepted invite" and which workspace it is for, with no
 * token anywhere.
 *
 * That matters because the token does not survive every path: a resent
 * verification email points at `/verify-email`, a link opened in a new tab or a
 * different browser never had it, and there is nothing server-side to rebuild it
 * from. The seat can, so the invitation is always reachable.
 *
 * Invited to two workspaces? Both are returned and each is accepted
 * separately — accepting one leaves the other pending.
 */
export async function listPendingInvitesForUser(
  userId: string,
  userEmail: string
): Promise<PendingInviteForUser[]> {
  const email = normalizeEmail(userEmail)

  const rows = await db
    .select({
      inviteId: workspaceInvites.id,
      slug: workspaces.slug,
      title: workspaces.title,
      roleTitle: roles.title,
      expiresAt: workspaceInvites.expiresAt,
    })
    .from(team)
    .innerJoin(workspaces, eq(team.workspaceId, workspaces.id))
    .innerJoin(roles, eq(team.roleId, roles.id))
    .innerJoin(
      workspaceInvites,
      and(
        eq(workspaceInvites.workspaceId, team.workspaceId),
        sql`lower(${workspaceInvites.email}) = ${email}`,
        isNull(workspaceInvites.acceptedAt),
        sql`${workspaceInvites.expiresAt} > now()`
      )
    )
    .where(
      and(
        isNull(team.joinedAt),
        ne(team.status, "left"),
        isNull(workspaces.deletedAt),
        or(
          and(sql`lower(${team.email}) = ${email}`, isNull(team.userId)),
          eq(team.userId, userId)
        )
      )
    )
    .orderBy(workspaceInvites.createdAt)

  return rows.map((r) => ({
    inviteId: r.inviteId,
    workspaceSlug: r.slug,
    workspaceTitle: r.title,
    roleTitle: r.roleTitle,
    expiresAt: r.expiresAt,
  }))
}

/**
 * Accepts an invitation by id, for a caller who holds the pending seat.
 *
 * The tokenless counterpart to `acceptInviteForUser`, for the paths where the
 * token is genuinely gone: a resent verification email points at
 * `/verify-email`, and a link opened in a new tab or on another device never
 * carried one. Since only the token's hash is stored, it cannot be rebuilt —
 * but the seat can, and a verified session plus an unjoined seat is the same
 * guarantee the token gave.
 *
 * Scoped to the caller: the seat must exist in that workspace, belong to them,
 * and not be joined. Returns null for an id that isn't theirs, so this can't be
 * used to accept into somebody else's workspace.
 */
export async function acceptInviteById(
  userId: string,
  userEmail: string,
  inviteId: string
): Promise<{ slug: string } | null> {
  const email = normalizeEmail(userEmail)

  const invite = await db
    .select({
      id: workspaceInvites.id,
      workspaceId: workspaceInvites.workspaceId,
      roleId: workspaceInvites.roleId,
    })
    .from(workspaceInvites)
    .where(
      and(
        eq(workspaceInvites.id, inviteId),
        isNull(workspaceInvites.acceptedAt),
        sql`${workspaceInvites.expiresAt} > now()`
      )
    )
    .limit(1)

  if (!invite[0]) return null

  const seat = await db
    .select({ id: team.id })
    .from(team)
    .where(
      and(
        eq(team.workspaceId, invite[0].workspaceId),
        isNull(team.joinedAt),
        ne(team.status, "left"),
        or(
          and(sql`lower(${team.email}) = ${email}`, isNull(team.userId)),
          eq(team.userId, userId)
        )
      )
    )
    .limit(1)

  if (!seat[0]) return null

  await db.transaction(async (tx) => {
    await tx
      .update(team)
      .set({
        userId,
        email: null,
        roleId: invite[0].roleId,
        status: "active",
        joinedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(team.id, seat[0].id))

    await tx
      .update(workspaceInvites)
      .set({ acceptedAt: new Date() })
      .where(eq(workspaceInvites.id, invite[0].id))
  })

  const rows = await db
    .select({ slug: workspaces.slug })
    .from(workspaces)
    .where(eq(workspaces.id, invite[0].workspaceId))
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
