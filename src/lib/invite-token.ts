/**
 * Invite tokens.
 *
 * The emailed token is 32 bytes of CSPRNG output, base64url encoded. Only its
 * SHA-256 is stored, so a database dump never yields a redeemable token —
 * matching the rule the rest of the auth surface already follows.
 *
 * Deliberately built on `globalThis.crypto` rather than `node:crypto`. This
 * module sits underneath `auth.ts`, which is imported by server-function
 * modules that route files also import, so a node-only API here ends up in the
 * client graph: `node:crypto` gets externalised for browser compatibility and
 * throws at module init, which kills hydration and leaves every form on the
 * page submitting natively. Web Crypto is available in both runtimes, so this
 * file is safe to import from anywhere.
 *
 * 32 bytes of entropy also means token validity is not observable through
 * guessing, which is what lets `findInviteByToken` collapse expired, accepted
 * and unknown into one result without the caller learning anything.
 */

const TOKEN_BYTES = 32

function toBase64Url(bytes: Uint8Array): string {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

/** A fresh token, plus the hash to persist. Returned together so the two can't be mixed up. */
export async function mintInviteToken(): Promise<{
  token: string
  tokenHash: string
}> {
  const bytes = new Uint8Array(TOKEN_BYTES)
  crypto.getRandomValues(bytes)
  const token = toBase64Url(bytes)
  return { token, tokenHash: await hashInviteToken(token) }
}

/** Deterministic, so a presented token can be looked up by hash. */
export async function hashInviteToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token)
  )
  return toHex(digest)
}

/** Seven days. Long enough to cover a holiday, short enough to matter. */
export const INVITE_TTL_DAYS = 7

export function inviteExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000)
}
