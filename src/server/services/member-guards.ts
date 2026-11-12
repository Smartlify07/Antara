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

import type { MembershipStatus } from "@/db/enums"

export type MemberAction = "change_role" | "remove" | "suspend" | "unsuspend"

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
  /** The seat's current status, which `suspend` and `unsuspend` read. */
  currentStatus: MembershipStatus
  /**
   * Managers who would remain if this action were applied, the owner included.
   * Cannot reach zero through this API today — the owner always counts — so
   * this guard is defence-in-depth for a future "leave workspace" or ownership
   * transfer, not a refusal a user can currently trigger.
   */
  remainingManagers: number
}

const OWNER_MESSAGE: Record<MemberAction, string> = {
  change_role: "The workspace owner's role can't be changed.",
  remove: "The workspace owner can't be removed.",
  suspend: "The workspace owner can't be suspended.",
  unsuspend: "The workspace owner is never suspended.",
}

const SELF_MESSAGE: Record<MemberAction, string> = {
  change_role: "You can't change your own role. Ask another admin to do it.",
  remove: "You can't remove yourself. Ask another admin to do it.",
  suspend: "You can't suspend yourself. Ask another admin to do it.",
  unsuspend: "You can't unsuspend yourself. Ask another admin to do it.",
}

export function checkMemberAction(
  facts: MemberActionFacts
): MemberRejection | null {
  if (facts.isOwner) {
    return { code: "owner", message: OWNER_MESSAGE[facts.action] }
  }

  if (facts.isSelf) {
    return { code: "self", message: SELF_MESSAGE[facts.action] }
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

  if (facts.action === "suspend" && facts.currentStatus !== "active") {
    return { code: "noop", message: "They're already suspended." }
  }

  if (facts.action === "unsuspend" && facts.currentStatus !== "suspended") {
    return { code: "noop", message: "They aren't suspended." }
  }

  // Suspending an admin removes them from the manager count, so it carries the
  // same risk as demoting or removing one.
  if (facts.remainingManagers < 1) {
    return {
      code: "last_admin",
      message: "At least one admin has to remain. Promote someone else first.",
    }
  }

  return null
}
