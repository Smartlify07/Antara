import { describe, expect, it } from "vitest"
import {
  annotateVersionFlags,
  assetApprovalState,
  librarySearchPattern,
} from "./library-scoping"
import { libraryFiltersSchema, parseLibrarySearch } from "@/lib/library-schemas"

/**
 * The Library's pure contracts (FR-039..044), pressed without a database —
 * which is exactly where a filter's meaning should be settled: the three
 * approval buckets must stay mutually exclusive, the FR-037 flags must
 * separate "latest version" from "latest approved version", and the search
 * pattern must not let a filename's `%` or `_` rewrite the query.
 *
 * What this file cannot cover: the DB reads themselves — the
 * project-scoped joins in `library-service.ts` (every row is filtered
 * through `projects.workspaceId` of the caller's workspace) can only be
 * exercised against a database, so their honest guarantee is the code's
 * structure, not a test.
 */

describe("the asset approval state derivation", () => {
  it("reads a live approval as approved", () => {
    expect(assetApprovalState(["approved"])).toBe("approved")
    // An approval sits on top of the newest reviewed work even while a
    // draft (never-submitted version) waits above it.
    expect(assetApprovalState([null, "approved"])).toBe("approved")
    expect(assetApprovalState([null, "superseded", "approved"])).toBe(
      "approved"
    )
  })

  it("reads replaced reviewed work as superseded", () => {
    // The newest generations while nothing is approved: earlier review
    // states were flipped by newer submissions, and none of it is blessed.
    expect(assetApprovalState(["submitted"])).toBe("not_approved")
    expect(assetApprovalState(["superseded", "submitted"])).toBe("superseded")
    expect(assetApprovalState(["superseded"])).toBe("superseded")
    expect(assetApprovalState(["superseded", "rejected"])).toBe("superseded")
  })

  it("keeps never-approved work out of both live buckets", () => {
    expect(assetApprovalState([])).toBe("not_approved")
    expect(assetApprovalState([null, null])).toBe("not_approved")
    expect(assetApprovalState(["rejected"])).toBe("not_approved")
    expect(assetApprovalState(["changes_requested"])).toBe("not_approved")
    expect(assetApprovalState([null, "changes_requested"])).toBe("not_approved")
  })

  it("offers exactly three mutually exclusive buckets over every status pair", () => {
    // The machine's rule (a new submission supersedes every earlier review
    // state; a superseded version cannot take a decision) keeps approved
    // and superseded off the same asset. The derivation must reflect that:
    // the three buckets partition, never overlap.
    const buckets = new Set([
      assetApprovalState(["approved"]),
      assetApprovalState(["superseded", "approved"]),
      assetApprovalState(["superseded"]),
      assetApprovalState(["submitted"]),
      assetApprovalState([]),
    ])
    expect(buckets.size).toBe(3)
  })
})

describe("the FR-037 version flags", () => {
  it("marks the newest version and the newest approved one separately", () => {
    // Newest first, exactly as the timeline orders it. A draft rides on top
    // of an approval: the LATEST version is not the LATEST APPROVED one.
    const [draft, approved, superseded] = annotateVersionFlags([
      { reviewStatus: null },
      { reviewStatus: "approved" },
      { reviewStatus: "superseded" },
    ])

    expect(draft.isLatest).toBe(true)
    expect(draft.isLatestApproved).toBe(false)
    expect(approved.isLatest).toBe(false)
    expect(approved.isLatestApproved).toBe(true)
    expect(superseded.isLatest).toBe(false)
    expect(superseded.isLatestApproved).toBe(false)
  })

  it("gives nothing the latest-approved flag when nothing was approved", () => {
    const rows = annotateVersionFlags([
      { reviewStatus: "submitted" },
      { reviewStatus: "superseded" },
    ])
    expect(rows.map((row) => row.isLatestApproved)).toEqual([false, false])
    expect(rows.map((row) => row.isLatest)).toEqual([true, false])
  })

  it("lets one version be both, when the approval is on the newest work", () => {
    const [top] = annotateVersionFlags([{ reviewStatus: "approved" }])
    expect(top.isLatest).toBe(true)
    expect(top.isLatestApproved).toBe(true)
  })

  it("flags the newest of several approvals", () => {
    // Two approved rows can only exist across a re-review that kept the
    // newer generation untouched on top; the flag follows the newest.
    const [rejected, approved, olderApproved] = annotateVersionFlags([
      { reviewStatus: "rejected" },
      { reviewStatus: "approved" },
      { reviewStatus: "approved" },
    ])
    expect(rejected.isLatestApproved).toBe(false)
    expect(approved.isLatestApproved).toBe(true)
    expect(olderApproved.isLatestApproved).toBe(false)
  })
})

describe("the metadata search pattern", () => {
  it("trims and drops empty searches", () => {
    expect(librarySearchPattern("")).toBeNull()
    expect(librarySearchPattern("   ")).toBeNull()
  })

  it("wraps the term as a contains-pattern", () => {
    expect(librarySearchPattern("keynotes")).toBe("%keynotes%")
  })

  it("does not let a filename's wildcards widen the query", () => {
    // Honest search: a literal `50%_off` finds that string, not half of the
    // library whose names happen to start with "50".
    expect(librarySearchPattern("50%_off")).toBe("%50\\%\\_off%")
    expect(librarySearchPattern("a\\b")).toBe("%a\\\\b%")
  })
})

describe("the library URL filters", () => {
  it("round-trips every filter word and drops empty ones", () => {
    expect(
      parseLibrarySearch({
        q: "  keynotes  ",
        type: "deck",
        project: "p1",
        deliverable: "d1",
        state: "approved",
      })
    ).toEqual({
      q: "keynotes",
      type: "deck",
      project: "p1",
      deliverable: "d1",
      state: "approved",
    })
    expect(parseLibrarySearch({ q: "", state: "" })).toEqual({
      q: undefined,
      type: undefined,
      project: undefined,
      deliverable: undefined,
      state: undefined,
    })
  })

  it("ignores state words it does not know", () => {
    // A stale bookmark must not fail navigation — it opens unfiltered.
    expect(
      parseLibrarySearch({ state: "pending_review" }).state
    ).toBeUndefined()
    expect(parseLibrarySearch({ state: 7 }).state).toBeUndefined()
  })

  const valid = {
    workspaceId: "w1",
    q: "deck",
    assetType: "deck",
    projectId: "p1",
    deliverableId: "d1",
    approvalState: "approved",
  } as const

  it("accepts a full filter set", () => {
    expect(libraryFiltersSchema.safeParse(valid).success).toBe(true)
  })

  it("keeps a deliverable filter honest by requiring its project", () => {
    // Assets scope through their project; a deliverable name alone names
    // nothing the request can keep true.
    expect(
      libraryFiltersSchema.safeParse({
        workspaceId: "w1",
        deliverableId: "d1",
      }).success
    ).toBe(false)
  })

  it("requires a workspace to ask in", () => {
    expect(libraryFiltersSchema.safeParse({ q: "deck" }).success).toBe(false)
  })

  it("lets a lone search stand", () => {
    const parsed = libraryFiltersSchema.safeParse({ workspaceId: "w1", q: "x" })
    expect(parsed.success).toBe(true)
  })
})
