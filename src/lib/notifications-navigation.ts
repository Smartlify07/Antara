/**
 * Where a notification row actually points (FR-048..050).
 *
 * The bell used to send every project-shaped event to the project Overview,
 * which is the wrong place for work that lives in the Work tab's cabinet.
 * This module is the single mapping from an event's subject to the exact
 * surface that shows it — pure, so the rules can be tested without a router:
 *
 * - a task        → its own task page
 * - a version     → the project's Work tab, that deliverable open, that
 *                   version's detail pane open
 * - a deliverable → the project's Work tab with that deliverable open
 * - a project     → the project page
 *
 * Anything whose project can no longer be resolved returns null: a gone
 * subject must not navigate somewhere misleading.
 */

const PROJECT_ROUTE = "/w/$workspaceSlug/projects/$projectSlug" as const

export type NotificationDestination =
  | {
      kind: "task"
      to: "/w/$workspaceSlug/projects/$projectSlug/tasks/$taskId"
      params: { workspaceSlug: string; projectSlug: string; taskId: string }
    }
  | {
      kind: "project"
      to: typeof PROJECT_ROUTE
      params: { workspaceSlug: string; projectSlug: string }
    }
  | {
      kind: "deliverable"
      to: typeof PROJECT_ROUTE
      params: { workspaceSlug: string; projectSlug: string }
      search: { tab: "work"; deliverable: string }
    }
  | {
      kind: "version"
      to: typeof PROJECT_ROUTE
      params: { workspaceSlug: string; projectSlug: string }
      search: { tab: "work"; deliverable: string; version: string }
    }

export interface NotificationTargetInput {
  subjectType: string
  subjectId: string
  /** The subject's project, when the server could still resolve it. */
  projectSlug: string | null
  /** The deliverable behind a version or deliverable subject. */
  deliverableId: string | null
}

export function notificationDestination(
  item: NotificationTargetInput,
  workspaceSlug: string
): NotificationDestination | null {
  if (!item.projectSlug) return null

  const params = {
    workspaceSlug,
    projectSlug: item.projectSlug,
  }

  if (item.subjectType === "task") {
    return {
      kind: "task",
      to: "/w/$workspaceSlug/projects/$projectSlug/tasks/$taskId",
      params: { ...params, taskId: item.subjectId },
    }
  }

  if (item.subjectType === "asset_version") {
    // The version's own pane needs its deliverable to open the cabinet at
    // the right level; without one, the project is still an honest landing.
    if (!item.deliverableId) {
      return { kind: "project", to: PROJECT_ROUTE, params }
    }
    return {
      kind: "version",
      to: PROJECT_ROUTE,
      params,
      search: {
        tab: "work",
        deliverable: item.deliverableId,
        version: item.subjectId,
      },
    }
  }

  if (item.subjectType === "deliverable") {
    return {
      kind: "deliverable",
      to: PROJECT_ROUTE,
      params,
      search: { tab: "work", deliverable: item.subjectId },
    }
  }

  // "project" and anything a newer emitter wrote: the project page is the
  // widest honest answer when the subject type is not one we can pinpoint.
  return { kind: "project", to: PROJECT_ROUTE, params }
}
