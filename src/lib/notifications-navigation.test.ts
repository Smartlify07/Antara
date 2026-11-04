import { describe, expect, it } from "vitest"
import { notificationDestination } from "./notifications-navigation"

const base = {
  subjectId: "subject-1",
  projectSlug: "brand-refresh",
  deliverableId: null,
}

describe("notificationDestination", () => {
  it("sends a task to its own page", () => {
    expect(
      notificationDestination(
        { ...base, subjectType: "task", subjectId: "task-1" },
        "acme"
      )
    ).toEqual({
      kind: "task",
      to: "/w/$workspaceSlug/projects/$projectSlug/tasks/$taskId",
      params: {
        workspaceSlug: "acme",
        projectSlug: "brand-refresh",
        taskId: "task-1",
      },
    })
  })

  it("sends a deliverable to the Work tab with that deliverable open", () => {
    expect(
      notificationDestination(
        { ...base, subjectType: "deliverable", subjectId: "del-1" },
        "acme"
      )
    ).toEqual({
      kind: "deliverable",
      to: "/w/$workspaceSlug/projects/$projectSlug",
      params: { workspaceSlug: "acme", projectSlug: "brand-refresh" },
      search: { tab: "work", deliverable: "del-1" },
    })
  })

  it("sends a version to the Work tab with the version pane open", () => {
    expect(
      notificationDestination(
        {
          ...base,
          subjectType: "asset_version",
          subjectId: "version-9",
          deliverableId: "del-1",
        },
        "acme"
      )
    ).toEqual({
      kind: "version",
      to: "/w/$workspaceSlug/projects/$projectSlug",
      params: { workspaceSlug: "acme", projectSlug: "brand-refresh" },
      search: {
        tab: "work",
        deliverable: "del-1",
        version: "version-9",
      },
    })
  })

  it("falls back to the project page when a version lost its deliverable", () => {
    expect(
      notificationDestination(
        { ...base, subjectType: "asset_version", subjectId: "version-9" },
        "acme"
      )
    ).toMatchObject({
      kind: "project",
      params: { workspaceSlug: "acme", projectSlug: "brand-refresh" },
    })
  })

  it("sends a project assignment to the project page", () => {
    expect(
      notificationDestination({ ...base, subjectType: "project" }, "acme")
    ).toMatchObject({
      kind: "project",
      params: { workspaceSlug: "acme", projectSlug: "brand-refresh" },
    })
  })

  it("does not navigate when the subject's project is gone", () => {
    expect(
      notificationDestination(
        { ...base, subjectType: "task", projectSlug: null },
        "acme"
      )
    ).toBeNull()
  })
})
