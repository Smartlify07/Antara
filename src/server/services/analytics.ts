import { PostHog } from "posthog-node"

/**
 * Server-side PostHog (product analytics) via posthog-node.
 *
 * A single module-scoped client, created lazily and only when POSTHOG_API_KEY
 * is present. Captures are fire-and-forget and swallowed on failure — analytics
 * must never take down, or measurably slow, a request path.
 *
 * Server-only: imported from server functions and better-auth hooks, never by
 * client code.
 */

const API_KEY = process.env.POSTHOG_API_KEY
const HOST = process.env.POSTHOG_HOST || "https://us.i.posthog.com"

let client: PostHog | null = null

function getClient(): PostHog | null {
  if (!API_KEY) return null
  client ??= new PostHog(API_KEY, { host: HOST })
  return client
}

export interface ServerEvent {
  distinctId: string
  event: string
  properties?: Record<string, unknown>
}

export function captureServerEvent({
  distinctId,
  event,
  properties,
}: ServerEvent): void {
  try {
    getClient()?.capture({ distinctId, event, properties })
  } catch (error) {
    console.error("[analytics] capture failed:", error)
  }
}

/** Flushes any queued events. Best-effort; safe to call on shutdown. */
export async function flushAnalytics(): Promise<void> {
  try {
    await client?.flush()
  } catch (error) {
    console.error("[analytics] flush failed:", error)
  }
}
