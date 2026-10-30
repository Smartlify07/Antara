import { waitUntil } from "@vercel/functions"
import { and, eq, inArray } from "drizzle-orm"
import { sendNotification, setVapidDetails } from "web-push"
import { db } from "@/db"
import { assets, assetVersions } from "@/db/schema/assets"
import { deliverables } from "@/db/schema/deliverables"
import { projects } from "@/db/schema/projects"
import { pushSubscriptions } from "@/db/schema/push-subscriptions"
import { tasks } from "@/db/schema/tasks"
import { user } from "@/db/schema/auth"
import { workspaces } from "@/db/schema/workspaces"
import { composePushPayload } from "./push-events"
import type { PushPayload } from "./push-events"

/**
 * Browser push delivery and subscription storage (Web Push / VAPID).
 *
 * Two halves, split by the same seam as the rest of the notification lane:
 *
 * - Subscription CRUD (`saveSubscription`, `removeSubscription`) is what the
 *   opt-in toggle writes, gated by session in the server-function boundary.
 * - `sendPushForEvent` fans an emitted notification out to every browser a
 *   recipient has opted in on.
 *
 * Delivery is fail-soft like outbound email (handoff §6): a push is a by-product
 * of real work, and a provider hiccup or a dead subscription must never fail the
 * action that produced the notification, nor surface its error to the caller.
 * Every send is therefore swallowed here, with one server-side log line at most.
 */

// The public key is non-secret but lives in two env vars: VITE_ for the client
// (build-inlined) and VAPID_PUBLIC_KEY here (runtime). The private key and
// subject are server-only.
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT ?? "mailto:noreply@smartlify.xyz"

function isConfigured(): boolean {
  return Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY)
}

let vapidConfigured = false
let warnedUnconfigured = false

function ensureVapid(): boolean {
  if (!isConfigured()) {
    // A config gap is worth exactly one line per process: silently doing
    // nothing is how this lane stayed broken without a trace.
    if (!warnedUnconfigured) {
      console.warn(
        "[push] VAPID keys are not configured — browser push is disabled"
      )
      warnedUnconfigured = true
    }
    return false
  }
  if (!vapidConfigured) {
    setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY!, VAPID_PRIVATE_KEY!)
    vapidConfigured = true
  }
  return true
}

// ---------------------------------------------------------------------------
// Subscription CRUD
// ---------------------------------------------------------------------------

export interface PushSubscriptionInput {
  endpoint: string
  keys: { p256dh: string; auth: string }
  userAgent?: string | null
}

/**
 * Stores a subscription for a user, keyed by endpoint so re-subscribing from
 * the same browser updates in place rather than stacking rows.
 */
export async function saveSubscription(
  userId: string,
  subscription: PushSubscriptionInput
): Promise<void> {
  await db
    .insert(pushSubscriptions)
    .values({
      userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent: subscription.userAgent ?? null,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        userId,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent: subscription.userAgent ?? null,
      },
    })
}

/** Removes one subscription, scoped to its owner so a caller can't clear others'. */
export async function removeSubscription(
  userId: string,
  endpoint: string
): Promise<void> {
  await db
    .delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.userId, userId),
        eq(pushSubscriptions.endpoint, endpoint)
      )
    )
}

// ---------------------------------------------------------------------------
// Subject resolution (one bounded query per event, mirroring the inbox reads)
// ---------------------------------------------------------------------------

interface ResolvedEvent {
  actorName: string | null
  subjectLabel: string | null
  projectSlug: string | null
  workspaceSlug: string | null
}

/**
 * Resolves the copy and the deep link for a single emitted event. Mirrors the
 * polymorphic resolution in `notification-service.listNotifications`, but for
 * one event instead of a page of them — four shapes, one query each.
 */
async function resolveEvent(input: {
  workspaceId: string
  actorId: string | null
  subjectType: string
  subjectId: string
}): Promise<ResolvedEvent> {
  const workspaceRows = await db
    .select({ slug: workspaces.slug })
    .from(workspaces)
    .where(eq(workspaces.id, input.workspaceId))
    .limit(1)

  const actorRows = input.actorId
    ? await db
        .select({ name: user.name })
        .from(user)
        .where(eq(user.id, input.actorId))
        .limit(1)
    : []

  let subjectLabel: string | null = null
  let projectSlug: string | null = null

  switch (input.subjectType) {
    case "project": {
      const rows = await db
        .select({ title: projects.title, slug: projects.slug })
        .from(projects)
        .where(eq(projects.id, input.subjectId))
        .limit(1)
      subjectLabel = rows[0]?.title ?? null
      projectSlug = rows[0]?.slug ?? null
      break
    }
    case "deliverable": {
      const rows = await db
        .select({
          title: deliverables.title,
          projectSlug: projects.slug,
        })
        .from(deliverables)
        .innerJoin(projects, eq(deliverables.projectId, projects.id))
        .where(eq(deliverables.id, input.subjectId))
        .limit(1)
      subjectLabel = rows[0]?.title ?? null
      projectSlug = rows[0]?.projectSlug ?? null
      break
    }
    case "task": {
      const rows = await db
        .select({ title: tasks.title, projectSlug: projects.slug })
        .from(tasks)
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .where(eq(tasks.id, input.subjectId))
        .limit(1)
      subjectLabel = rows[0]?.title ?? null
      projectSlug = rows[0]?.projectSlug ?? null
      break
    }
    case "asset_version": {
      const rows = await db
        .select({
          filename: assets.filename,
          label: assetVersions.label,
          projectSlug: projects.slug,
        })
        .from(assetVersions)
        .innerJoin(assets, eq(assetVersions.assetId, assets.id))
        .innerJoin(projects, eq(assets.projectId, projects.id))
        .where(eq(assetVersions.id, input.subjectId))
        .limit(1)
      // "brief-final.mov (v3)" — the file is the identity, the label the cut.
      subjectLabel =
        rows[0]?.filename && rows[0]?.label
          ? `${rows[0].filename} (${rows[0].label})`
          : null
      projectSlug = rows[0]?.projectSlug ?? null
      break
    }
    default:
      break
  }

  return {
    actorName: actorRows[0]?.name ?? null,
    subjectLabel,
    projectSlug,
    workspaceSlug: workspaceRows[0]?.slug ?? null,
  }
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

export interface PushEvent {
  workspaceId: string
  actorId: string | null
  type: string
  subjectType: string
  subjectId: string
  recipientIds: string[]
}

/**
 * Fans a notification out to every browser its recipients opted in on. Called
 * fire-and-forget from the emitter; swallows every failure so a bad
 * subscription or a missing VAPID keypair can never fail the triggering action.
 */
export async function sendPushForEvent(event: PushEvent): Promise<void> {
  if (event.recipientIds.length === 0) return

  try {
    // Inside the try on purpose: `setVapidDetails` throws on a malformed
    // keypair, and that must degrade to one log line, not a rejected promise.
    if (!ensureVapid()) return

    const resolved = await resolveEvent(event)
    if (!resolved.workspaceSlug) return

    const payload: PushPayload = composePushPayload({
      type: event.type,
      subjectType: event.subjectType,
      subjectId: event.subjectId,
      actorName: resolved.actorName,
      subjectLabel: resolved.subjectLabel,
      workspaceSlug: resolved.workspaceSlug,
      projectSlug: resolved.projectSlug,
    })

    const subscriptions = await db
      .select({
        endpoint: pushSubscriptions.endpoint,
        p256dh: pushSubscriptions.p256dh,
        auth: pushSubscriptions.auth,
      })
      .from(pushSubscriptions)
      .where(inArray(pushSubscriptions.userId, event.recipientIds))

    if (subscriptions.length === 0) return

    const results = await Promise.allSettled(
      subscriptions.map((subscription) => sendOne(subscription, payload))
    )
    const delivered = results.filter(
      (result) => result.status === "fulfilled" && result.value
    ).length

    // One line per event that had a browser to reach, so a future "nothing
    // arrives" report has an answer in the logs instead of a mystery.
    console.info(
      `[push] ${event.type}: delivered ${delivered}/${subscriptions.length}`
    )
  } catch (error) {
    console.error("[push] event could not be delivered:", error)
  }
}

/**
 * Hands an event's fan-out to the runtime and returns immediately. On Vercel
 * the request is over by the time this resolves — a bare `void` promise is
 * frozen mid-flight, which is exactly how the first version silently dropped
 * every push. `waitUntil` keeps the invocation alive until delivery finishes;
 * elsewhere (local dev, tests) there is no request context and a plain
 * fire-and-forget is correct.
 */
export function queuePush(event: PushEvent): void {
  const task = sendPushForEvent(event)
  try {
    waitUntil(task)
  } catch {
    void task
  }
}

async function sendOne(
  subscription: {
    endpoint: string
    p256dh: string
    auth: string
  },
  payload: PushPayload
): Promise<boolean> {
  try {
    await sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload)
    )
    return true
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode
    if (statusCode === 404 || statusCode === 410) {
      // The subscription no longer exists on the push service (the browser
      // revoked permission or the endpoint expired). Drop the row so future
      // sends don't keep failing on it.
      await db
        .delete(pushSubscriptions)
        .where(eq(pushSubscriptions.endpoint, subscription.endpoint))
      return false
    }
    console.error(
      `[push] send failed (${statusCode ?? "unknown"}) to ${subscription.endpoint}:`,
      error instanceof Error ? error.message : error
    )
    return false
  }
}
