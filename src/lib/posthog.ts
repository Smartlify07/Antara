import posthog from "posthog-js"

/**
 * Client-side PostHog (product analytics).
 *
 * Initialized once at module load, on the browser only. Everything degrades to
 * a no-op when `VITE_POSTHOG_KEY` is unset, so the app boots fine with a
 * placeholder `.env`, in tests, and during SSR (where there is no `window`).
 */

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY
const POSTHOG_HOST =
  import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com"

const enabled = typeof window !== "undefined" && !!POSTHOG_KEY

if (enabled) {
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    // Track SPA navigations (TanStack Router uses the history API, which
    // posthog-js patches for automatic `$pageview` capture).
    capture_pageview: true,
    capture_pageleave: true,
    persistence: "localStorage+cookie",
  })
}

export function trackEvent(
  event: string,
  properties?: Record<string, unknown>
): void {
  if (!enabled) return
  posthog.capture(event, properties)
}

export function identifyUser(
  id: string,
  properties?: Record<string, unknown>
): void {
  if (!enabled) return
  posthog.identify(id, properties)
}

export function resetUser(): void {
  if (!enabled) return
  posthog.reset()
}
