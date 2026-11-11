/**
 * Scheme allowlists for user-supplied links.
 *
 * These URLs are rendered into `href` attributes, so the scheme is the whole
 * security boundary: `javascript:` and `data:` are script execution, `file:`
 * is a local-file probe. `z.string().url()` accepts all of them, so every
 * stored link is checked here instead.
 */

const HTTP_PROTOCOLS = new Set(["http:", "https:"])
const REFERENCE_PROTOCOLS = new Set(["http:", "https:", "mailto:"])

function hasAllowedProtocol(value: string, allowed: Set<string>): boolean {
  try {
    return allowed.has(new URL(value).protocol)
  } catch {
    return false
  }
}

/** A URL that can only navigate to another web page. */
export function isHttpUrl(value: string): boolean {
  return hasAllowedProtocol(value, HTTP_PROTOCOLS)
}

/** A reference link: a web page or an email address. */
export function isSafeReferenceLink(value: string): boolean {
  return hasAllowedProtocol(value, REFERENCE_PROTOCOLS)
}
