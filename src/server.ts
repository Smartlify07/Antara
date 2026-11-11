import * as Sentry from "@sentry/tanstackstart-react"
import handler, {
  createServerEntry,
} from "@tanstack/react-start/server-entry"

/**
 * Custom server entry: wraps the TanStack Start handler with Sentry so server
 * functions and request handling are traced and errors are captured.
 *
 * `Sentry.init` is guarded on SENTRY_DSN so the server still boots when the key
 * is absent (placeholder `.env`). `wrapFetchWithSentry` is equally safe without
 * an initialized client — it degrades to a pass-through.
 */
const dsn = process.env.SENTRY_DSN
if (dsn) {
  Sentry.init({
    dsn,
    // Lower this in production; 100% traces is for bootstrapping.
    tracesSampleRate: 1.0,
  })
}

/**
 * Baseline response hardening. Set on every response here rather than in the
 * Vercel config alone, so self-hosted/preview runs get the same treatment as
 * the deployed app. CSP is report-only: it cannot break a page while the
 * allowlist is tuned, but violations still surface in the console.
 */
const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Content-Security-Policy-Report-Only":
    "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://*.posthog.com https://*.sentry.io https://api.cloudinary.com; form-action 'self'",
}

function withSecurityHeaders(response: Response): Response {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    // A route that sets its own value (e.g. a stricter frame policy) wins.
    if (!response.headers.has(key)) response.headers.set(key, value)
  }
  return response
}

export default createServerEntry(
  Sentry.wrapFetchWithSentry({
    async fetch(request: Request) {
      return withSecurityHeaders(await handler.fetch(request))
    },
  })
)
