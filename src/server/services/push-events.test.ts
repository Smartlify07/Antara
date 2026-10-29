import { describe, expect, it } from "vitest"
import { composePushPayload, pushTargetUrl } from "./push-events"

/**
 * The browser-push payload composer's pure contract: a push reads the same
 * body the bell renders, deep-links the same way the inbox jumps, and tags
 * itself so updates to one subject replace each other in the OS tray.
 */

describe("pushTargetUrl", () => {
  it("deep-links an assigned task to its own page", () => {
    expect(pushTargetUrl("acme", "task", "task-1", "rebrand")).toBe(
      "/w/acme/projects/rebrand/tasks/task-1"
    )
  })

  it("deep-links anything with a project to the project page", () => {
    expect(pushTargetUrl("acme", "asset_version", "v-9", "rebrand")).toBe(
      "/w/acme/projects/rebrand"
    )
  })

  it("falls back to the workspace's projects when no project resolves", () => {
    expect(pushTargetUrl("acme", "task", "task-1", null)).toBe(
      "/w/acme/projects"
    )
  })
})

describe("composePushPayload", () => {
  it("carries the same body the inbox renders", () => {
    const payload = composePushPayload({
      type: "task_assigned",
      subjectType: "task",
      subjectId: "task-1",
      actorName: "Ada",
      subjectLabel: "Cut the intro",
      workspaceSlug: "acme",
      projectSlug: "rebrand",
    })
    expect(payload.body).toBe("Ada assigned Cut the intro to you")
  })

  it("sets the app title and a subject-scoped tag", () => {
    const payload = composePushPayload({
      type: "version_feedback",
      subjectType: "asset_version",
      subjectId: "v-9",
      actorName: "Ada",
      subjectLabel: "trailer.mov (v3)",
      workspaceSlug: "acme",
      projectSlug: "rebrand",
    })
    expect(payload.title).toBe("Antara")
    expect(payload.tag).toBe("asset_version:v-9")
  })

  it("degrades a gone actor and subject to impersonal copy", () => {
    const payload = composePushPayload({
      type: "task_assigned",
      subjectType: "task",
      subjectId: "task-1",
      actorName: null,
      subjectLabel: null,
      workspaceSlug: "acme",
      projectSlug: null,
    })
    expect(payload.body).toBe("a task was assigned to you")
  })
})
