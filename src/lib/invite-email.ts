/**
 * Whether the account accepting an invite is the address it was sent to.
 *
 * The token proves "you were sent this link"; this proves the link was sent to
 * *you*. Without it, anyone who receives a forwarded invite (or finds one in a
 * shared inbox) can join the workspace as themselves — the token becomes a
 * workspace password rather than an invitation addressed to one person.
 */
import { normalizeEmail } from "@/lib/normalize-email"

export function inviteEmailMatches(
  inviteEmail: string,
  userEmail: string
): boolean {
  return normalizeEmail(inviteEmail) === normalizeEmail(userEmail)
}
