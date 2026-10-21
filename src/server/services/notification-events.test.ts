import { describe, expect, it } from "vitest"
import {
  describeNotification,
  isNotificationSubjectType,
  isNotificationType,
  notificationSubjectTypes,
  notificationTypes,
  resolveRecipients,
} from "./notification-events"

/**
 * The notification emitter's pure contract (FR-047..050): the event
 * vocabulary every surface agrees on, the self-notification guard the bell
 * lives and dies by, and the inbox copy a mixed missing-actor/missing-subject
 * row degrades to. No database — see `workflow-states.test.ts` for the
 * philosophy.
 */

describe("event vocabulary", () => {
  it("declares every type the schema's text column may hold", () => {
    expect(notificationTypes).toHaveLength(8)
    for (const type of notificationTypes) {
      expect(isNotificationType(type)).toBe(true)
    }
  })

  it("renders unknown types neutrally instead of guessing", () => {
    const copy = describeNotification("phantom_event", "task", "Ada", "Item")
    expect(copy.known).toBe(false)
    // Honest vagueness, not copy claiming a specific thing happened.
    expect(copy.message.toLowerCase().includes("something")).toBe(true)
  })

  it("declares every jump target the polymorphic pair points at", () => {
    expect(notificationSubjectTypes).toHaveLength(4)
    for (const subject of notificationSubjectTypes) {
      expect(isNotificationSubjectType(subject)).toBe(true)
    }
    expect(isNotificationSubjectType("video")).toBe(false)
  })
})

describe("self-notification dedupe (resolveRecipients)", () => {
  it("never notifies the actor about their own action", () => {
    expect(resolveRecipients(["u1", "u2"], "u1")).toEqual(["u2"])
    expect(resolveRecipients(["u1"], "u1")).toEqual([])
  })

  it("collapses duplicates and drops empty candidates", () => {
    expect(resolveRecipients(["u1", "u1", "u2"], null)).toEqual(["u1", "u2"])
    expect(resolveRecipients([undefined, null, ""], null)).toEqual([])
  })

  it("tolerates a gone actor row", () => {
    expect(resolveRecipients(["u1", "u3"], null)).toEqual(["u1", "u3"])
  })
})

describe("inbox copy", () => {
  it("names the actor and the subject for every assignment event", () => {
    expect(
      describeNotification("project_assigned", "project", "Ada", "Rebrand")
        .message
    ).toBe("Ada added you to Rebrand")
    expect(
      describeNotification(
        "deliverable_assigned",
        "deliverable",
        "Ada",
        "Trailer"
      ).message
    ).toBe("Ada put you in charge of Trailer")
    expect(
      describeNotification("task_assigned", "task", "Ada", "Cut the intro")
        .message
    ).toBe("Ada assigned Cut the intro to you")
  })

  it("says which way a version decision went", () => {
    expect(
      describeNotification(
        "version_review_approved",
        "asset_version",
        "Ada",
        "trailer.mov (v3)"
      ).message
    ).toBe("Ada approved trailer.mov (v3)")
    expect(
      describeNotification(
        "version_review_rejected",
        "asset_version",
        "Ada",
        "trailer.mov (v3)"
      ).message
    ).toBe("Ada rejected trailer.mov (v3)")
    expect(
      describeNotification(
        "version_review_changes_requested",
        "asset_version",
        "Ada",
        "trailer.mov (v3)"
      ).message
    ).toBe("Ada requested changes to trailer.mov (v3)")
  })

  it("survives a gone actor with impersonal copy", () => {
    expect(
      describeNotification("task_assigned", "task", null, "Cut the intro")
        .message
    ).toBe("Cut the intro was assigned to you")
    expect(
      describeNotification("project_assigned", "project", null, "Rebrand")
        .message
    ).toBe("You were added to Rebrand")
  })

  it("survives a gone subject with the fallback label", () => {
    expect(
      describeNotification("project_assigned", "project", "Ada", null).message
    ).toBe("Ada added you to a project")
    expect(
      describeNotification("task_assigned", "task", "Ada", "").message
    ).toBe("Ada assigned a task to you")
  })

  it("treats an empty actor name as gone, not as a blank name", () => {
    expect(
      describeNotification("task_assigned", "task", "  ", "Cut").message
    ).toBe("Cut was assigned to you")
  })
})

describe("inbox copy parts", () => {
  it("splits the actor's name into its own segment so the inbox can bold it", () => {
    const copy = describeNotification(
      "task_assigned",
      "task",
      "Ada",
      "Cut the intro"
    )
    expect(copy.parts).toEqual([
      { text: "Ada", actor: true },
      { text: " assigned " },
      { text: "Cut the intro" },
      { text: " to you" },
    ])
  })

  it("keeps the plain message the exact join of the parts", () => {
    const copy = describeNotification(
      "version_feedback",
      "asset_version",
      "Ada",
      "trailer.mov (v3)"
    )
    expect(copy.message).toBe(copy.parts.map((part) => part.text).join(""))
  })

  it("leaves impersonal copy without an actor segment", () => {
    expect(
      describeNotification("project_assigned", "project", null, "Rebrand").parts
    ).toEqual([{ text: "You were added to Rebrand" }])
  })
})
