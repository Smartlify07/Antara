import { createHash, randomBytes } from "node:crypto"

/**
 * Invite tokens.
 *
 * The emailed token is 32 bytes from the CSPRNG, base64url encoded. Only its
 * SHA-256 is stored, so a database dump never yields a redeemable token —
 * matching the rule the rest of the auth surface already follows.
 *
 * 32 bytes of entropy also means token validity is not observable through
 * guessing, which is what lets `findInvite` tell the difference between an
 * expired and an unknown token internally without it mattering to a caller.
 */

const TOKEN_BYTES = 32

/** A fresh token, plus the hash to persist. Returned together so the two can't be mixed up. */
export function mintInviteToken(): { token: string; tokenHash: string } {
  const token = randomBytes(TOKEN_BYTES).toString("base64url")
  return { token, tokenHash: hashInviteToken(token) }
}

/** Deterministic, so a presented token can be looked up by hash. */
export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

/** Seven days. Long enough to cover a holiday, short enough to matter. */
export const INVITE_TTL_DAYS = 7

export function inviteExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000)
}