import { describe, expect, it } from "vitest"
import { groupAssetsIntoFolders } from "./folder-grouping"
import type { LibraryAssetSummary } from "@/server/services/library-service"

/**
 * The folder wall's fold: assets into their projects, in the projects'
 * order, with a last-activity stamp per folder. Pure assertions — no
 * database, no components.
 */

const DAY = 24 * 60 * 60 * 1000

function summaryAsset(
  id: string,
  projectId: string,
  touched: Date
): LibraryAssetSummary {
  return {
    id,
    filename: `${id}.pdf`,
    assetType: null,
    tags: null,
    createdAt: new Date("2026-01-01"),
    createdBy: null,
    projectId,
    projectTitle: `Project ${projectId}`,
    projectSlug: `p-${projectId}`,
    deliverableId: null,
    deliverableTitle: null,
    versionCount: 1,
    approvalState: "not_approved",
    versions: [],
    latestVersion: {
      id: `${id}-v1`,
      versionNo: 1,
      label: "v1",
      reviewStatus: null,
      source: "external_link",
      url: "https://example.com",
      externalProvider: null,
      createdAt: touched,
      submitter: { name: null, email: null },
    },
    latestApproved: null,
  }
}

describe("groupAssetsIntoFolders", () => {
  it("folds assets into their projects without reordering either", () => {
    const now = new Date()
    const projects = [
      {
        id: "p1",
        title: "Aurora",
        slug: "aurora",
        gradientStart: null,
        gradientEnd: null,
      },
      {
        id: "p2",
        title: "Northwind",
        slug: "northwind",
        gradientStart: null,
        gradientEnd: null,
      },
    ]
    // Arrival order interleaves the projects; the list is recency-first.
    const assets = [
      summaryAsset("a1", "p1", now),
      summaryAsset("a2", "p2", new Date(now.getTime() - 2 * DAY)),
      summaryAsset("a3", "p1", new Date(now.getTime() - 4 * DAY)),
    ]

    const folders = groupAssetsIntoFolders(assets, projects)

    expect(folders.map((folder) => folder.id)).toEqual(["p1", "p2"])
    expect(folders[0].assets.map((asset) => asset.id)).toEqual(["a1", "a3"])
    expect(folders[1].assets.map((asset) => asset.id)).toEqual(["a2"])
  })

  it("stamps a folder with its newest touch and null when it is empty", () => {
    const now = new Date()
    const projects = [
      {
        id: "p1",
        title: "Aurora",
        slug: "aurora",
        gradientStart: null,
        gradientEnd: null,
      },
      {
        id: "p2",
        title: "Northwind",
        slug: "northwind",
        gradientStart: null,
        gradientEnd: null,
      },
    ]

    const folders = groupAssetsIntoFolders([summaryAsset("a1", "p1", now)], projects)

    expect(folders[0].lastActivity).toEqual(now)
    expect(folders[1].lastActivity).toBeNull()
  })

  it("keeps a book whose project has no list row rather than dropping it", () => {
    const now = new Date()
    const orphan = summaryAsset("a9", "p9", now)

    const folders = groupAssetsIntoFolders([orphan], [])

    expect(folders).toHaveLength(1)
    expect(folders[0]).toMatchObject({ id: "p9", title: "Project p9" })
    expect(folders[0].lastActivity).toEqual(now)
  })
})
