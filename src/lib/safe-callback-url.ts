/**
 * Guards a `callbackURL` coming from a query string before we navigate to it.
 *
 * better-auth validates its *own* redirects against `trustedOrigins`, but this
 * is a client-side navigation we control, so nothing checks it for us. Without
 * this, `/login?callbackURL=https://evil.com` is an open redirect off our own
 * domain — and the link would be clickable on a page we render.
 *
 * Accepts only a single-slash-prefixed relative path. Rejects protocol-relative
 * (`//evil.com`, which browsers treat as absolute), anything with a scheme,
 * and backslash variants that some parsers normalise to a slash.
 */
export function safeCallbackURL(value: string | undefined): string | null {
  if (!value) return null
  if (!value.startsWith("/")) return null
  if (value.startsWith("//")) return null
  if (value.includes("\\")) return null
  // Encoded separators can survive to the router and still resolve outward.
  if (/%2f|%5c/i.test(value)) return null
  return value
}
