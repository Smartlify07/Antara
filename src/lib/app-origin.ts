/**
 * The public origin that links in outbound email must point at.
 *
 * Both emails carry a link the recipient clicks from another device:
 * `sendInviteEmail` builds `/invite/$token`, and better-auth builds the
 * verification URL from its `baseURL`. Both were resolving to
 * `http://localhost:3000` in production — every invite and verification mail
 * was a dead link.
 *
 * Two independent causes, and this closes both:
 *
 * - The invite template took an *optional* `appUrl` that no caller ever
 *   passed, so it silently fell through to a hardcoded localhost.
 * - `BETTER_AUTH_URL` was set to the empty string in the Vercel production
 *   environment, so better-auth fell back to its own localhost default. The
 *   client variable `VITE_BETTER_AUTH_URL` was correct, which is exactly why
 *   the app worked and only the mail was broken.
 *
 * Server-only. Do not import from client code — `process.env.APP_URL` is
 * inlined at build time and would leak the value into the browser bundle.
 */

const DEV_ORIGIN = "http://localhost:3000"

function isLocal(origin: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?/i.test(origin)
}

/**
 * Resolves the public origin, or throws in production.
 *
 * Throwing is deliberate. A localhost link in an outbound email is a dead link
 * the recipient cannot act on, and it fails *silently*: the invite row is
 * created, the admin sees a success toast, and the mail that would have
 * delivered the link is the one thing broken. Failing at the point the origin
 * is resolved turns a quiet production defect into a visible error.
 */
export function appOrigin(): string {
  // `APP_URL` is the honest name and wins when present. `BETTER_AUTH_URL` is
  // the fallback because it is already configured per environment and holds
  // the same value — but an empty string is a *set* variable, so it must be
  // treated as absent rather than passed through.
  const configured =
    process.env.APP_URL?.trim() || process.env.BETTER_AUTH_URL?.trim() || ""

  if (!configured) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "Cannot build email links: neither APP_URL nor BETTER_AUTH_URL is set. " +
          "A localhost link in a production email is a dead link."
      )
    }
    return DEV_ORIGIN
  }

  const base = configured.replace(/\/+$/, "")

  if (process.env.NODE_ENV === "production" && isLocal(base)) {
    throw new Error(
      `Cannot build email links: APP_URL/BETTER_AUTH_URL resolves to ${base} in production.`
    )
  }

  return base
}
