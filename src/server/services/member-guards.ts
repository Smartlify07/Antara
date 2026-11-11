/**
 * The member-management guard table, as pure predicates.
 *
 * Kept out of `member-service` so every rule is testable without a database —
 * the same reason `work-permissions.ts` exists for the task/deliverable lane.
 * The service supplies the facts; this file decides, and never touches the DB.
 *
 * The guards are deliberately about *targets*. Whether the actor may manage the
 * workspace at all is answered by `access-service.resolveMembership`, and only
 * there.
 */

export type MemberAction = "change_role" | "remove"

export type MemberRejectionCode =
  "owner" | "self" | "pending" | "noop" | "last_admin"

export interface MemberRejection {
  code: MemberRejectionCode
  /** Safe to show an admin as-is. */
  message: string
}

export interface MemberActionFacts {
  action: MemberAction
  /** The target row belongs to the workspace owner. */
  isOwner: boolean
  /** The target row belongs to the caller. */
  isSelf: boolean
  /** A reserved seat from an invite nobody has accepted yet. */
  isPending: boolean
  /** The target's current workspace-scope role title. */
  currentRole: string
  /** The role the target would hold after a `change_role`. */
  nextRole?: string
  /**
   * Active managers who would remain if this action were applied — the owner
   * included unless the workspace's owner has left.
   */
  remainingManagers: number
}

export function checkMemberAction(
  facts: MemberActionFacts
): MemberRejection | null {
  if (facts.isOwner) {
    return {
      code: "owner",
      message:
        facts.action === "remove"
          ? "The workspace owner can't be removed."
          : "The workspace owner's role can't be changed.",
    }
  }

  if (facts.isSelf) {
    return {
      code: "self",
      message:
        facts.action === "remove"
          ? "You can't remove yourself. Ask another admin to do it."
          : "You can't change your own role. Ask another admin to do it.",
    }
  }

  if (facts.isPending) {
    return {
      code: "pending",
      message:
        "This invite hasn't been accepted yet. Revoke the invite instead.",
    }
  }

  if (facts.action === "change_role" && facts.nextRole === facts.currentRole) {
    return {
      code: "noop",
      message: `They already have the ${facts.currentRole} role.`,
    }
  }

  // Load-bearing even though the owner usually counts: a workspace whose owner
  // has left must not lose its last working admin.
  if (facts.remainingManagers < 1) {
    return {
      code: "last_admin",
      message: "At least one admin has to remain. Promote someone else first.",
    }
  }

  return null
}
