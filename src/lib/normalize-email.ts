/**
 * Email normalization.
 *
 * Postgres `unique` is case-sensitive, so "Ada@x.com" and "ada@x.com" would
 * otherwise be two distinct accounts. That breaks invite backfill matching
 * (the invite is stored one way, the signup the other) and lets two people
 * hold what is, to a human, the same identity.
 *
 * Applied on write here, and enforced on read by unique indexes on
 * lower(email).
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}
