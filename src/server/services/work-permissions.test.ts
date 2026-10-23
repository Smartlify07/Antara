import { describe, expect, it } from "vitest"
import {
  assertTaskStatusMove,
  canDecideVersion,
  canManageDeliverables,
  canMoveProductionStatus,
  canSubmitVersion,
  canWorkOnTasks,
} from "./work-permissions"
import type { WorkPermissionFacts } from "./work-permissions"
import type { TaskStatus } from "@/db/enums"

/**
 * The work lane's permission and transition contracts, pressed without a
 * database. The plan's Increment 3 gate names these: deliverable management
 * is lead+admin (owner can also move status), tasks are member-level, and
 * every task status move is legal except the no-op — which is recorded rather
 * than re-decided.
 */

function facts(overrides: Partial<WorkPermissionFacts>): WorkPermissionFacts {
  return {
    isWorkspaceAdmin: false,
    isProjectLead: false,
    isProjectMember: false,
    viewerTeamId: null,
    ...overrides,
  }
}

describe("deliverable permission predicates", () => {
  const owned = "team-1"

  it("lets workspace admins and project leads manage deliverables", () => {
    expect(canManageDeliverables(facts({ isWorkspaceAdmin: true }))).toBe(true)
    expect(canManageDeliverables(facts({ isProjectLead: true }))).toBe(true)
    expect(
      canManageDeliverables(
        facts({ isProjectMember: true, viewerTeamId: owned })
      )
    ).toBe(false)
  })

  it("lets admins, leads, and the deliverable's own owner move status", () => {
    expect(
      canMoveProductionStatus(facts({ isWorkspaceAdmin: true }), null)
    ).toBe(true)
    expect(canMoveProductionStatus(facts({ isProjectLead: true }), null)).toBe(
      true
    )
    // Owner without any role: can move their own card.
    expect(canMoveProductionStatus(facts({ viewerTeamId: owned }), owned)).toBe(
      true
    )
    // ...but not someone else's.
    expect(
      canMoveProductionStatus(facts({ viewerTeamId: owned }), "team-2")
    ).toBe(false)
    // A plain member who owns nothing.
    expect(
      canMoveProductionStatus(facts({ isProjectMember: true }), owned)
    ).toBe(false)
  })

  it("never lets a null owner match an absent viewer team", () => {
    expect(canMoveProductionStatus(facts({ viewerTeamId: null }), null)).toBe(
      false
    )
  })
})

describe("version permission predicates", () => {
  const owned = "team-1"

  it("lets the deliverable's own owner submit versions, plus admin/lead (FR-020)", () => {
    expect(canSubmitVersion(facts({ viewerTeamId: owned }), owned)).toBe(true)
    expect(canSubmitVersion(facts({ isProjectLead: true }), owned)).toBe(true)
    expect(canSubmitVersion(facts({ isWorkspaceAdmin: true }), owned)).toBe(
      true
    )
    // Admins lead even unowned work.
    expect(canSubmitVersion(facts({ isWorkspaceAdmin: true }), null)).toBe(true)
  })

  it("refuses co-members of the deliverable", () => {
    expect(
      canSubmitVersion(
        facts({ isProjectMember: true, viewerTeamId: "team-2" }),
        owned
      )
    ).toBe(false)
    // Owner authority needs an owner; a plain holder of a team id with no
    // deliverable owner cannot extend it.
    expect(canSubmitVersion(facts({ viewerTeamId: owned }), null)).toBe(false)
    expect(canSubmitVersion(facts({}), owned)).toBe(false)
  })

  it("restricts decisions to project lead + workspace admin (FR-033, MVP rule)", () => {
    expect(canDecideVersion(facts({ isWorkspaceAdmin: true }))).toBe(true)
    expect(canDecideVersion(facts({ isProjectLead: true }))).toBe(true)
    // The submitter is never the reviewer, however involved they are.
    expect(
      canDecideVersion(facts({ isProjectMember: true, viewerTeamId: owned }))
    ).toBe(false)
    expect(canDecideVersion(facts({}))).toBe(false)
  })
})

describe("task permission predicates", () => {
  it("gates task writes on project membership", () => {
    expect(canWorkOnTasks(facts({ isWorkspaceAdmin: true }))).toBe(true)
    expect(canWorkOnTasks(facts({ isProjectMember: true }))).toBe(true)
    expect(canWorkOnTasks(facts({}))).toBe(false)
    // A lead is a member by construction; a non-member is never allowed.
    expect(canWorkOnTasks(facts({ isProjectLead: true }))).toBe(false)
  })
})

describe("task status transitions", () => {
  const STATUSES: TaskStatus[] = [
    "backlog",
    "todo",
    "in_progress",
    "done",
    "approved",
  ]

  it("forbids the no-op move — the audit-trail lie", () => {
    for (const status of STATUSES) {
      expect(() => assertTaskStatusMove(status, status)).toThrow(/already/)
    }
  })

  it("allows every forward move, including work entering review by approval", () => {
    expect(() => assertTaskStatusMove("in_progress", "done")).not.toThrow()
    expect(() => assertTaskStatusMove("done", "approved")).not.toThrow()
    expect(() => assertTaskStatusMove("backlog", "in_progress")).not.toThrow()
    expect(() => assertTaskStatusMove("todo", "in_progress")).not.toThrow()
  })

  it("allows reopens — creative work legitimately bounces back", () => {
    expect(() => assertTaskStatusMove("done", "todo")).not.toThrow()
    expect(() => assertTaskStatusMove("done", "in_progress")).not.toThrow()
    expect(() => assertTaskStatusMove("approved", "in_progress")).not.toThrow()
    expect(() => assertTaskStatusMove("in_progress", "backlog")).not.toThrow()
  })
})
