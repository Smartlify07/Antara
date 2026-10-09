/**
 * Remembers which address is waiting to be verified.
 *
 * When a verification link is dead, better-auth redirects to
 * `callbackURL?error=TOKEN_EXPIRED` and nothing else. The address lives inside
 * the JWT we can no longer read, and no session exists to read it from either
 * — an expired token can't be exchanged for one. Without this, the only way to
 * get a fresh link is to make the visitor type their own email again.
 *
 * Client-side and per-browser, which is the right scope: it survives the
 * redirect that follows an emailed link, and it's an address the person
 * already typed into this browser. Someone wanting to mail a stranger still
 * has to use the form, so this is convenience, not a new capability.
 *
 * Store only the address. Never a token.
 */

const KEY = "antara:pending-verification"

function storage(): Storage | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage
  } catch {
    // Private mode or a blocked-cookies setting.
    return null
  }
}

export function rememberPendingVerification(email: string): void {
  storage()?.setItem(KEY, email.trim())
}

export function readPendingVerification(): string | null {
  try {
    return storage()?.getItem(KEY) ?? null
  } catch {
    return null
  }
}

export function clearPendingVerification(): void {
  try {
    storage()?.removeItem(KEY)
  } catch {
    // Nothing to do — a stale entry only means a prefill we shouldn't show.
  }
}
