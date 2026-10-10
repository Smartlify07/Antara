import { z } from "zod"

/**
 * Parses a pasted list of addresses into a validated, de-duplicated batch.
 *
 * People paste from all sorts of places: a column out of a spreadsheet, a
 * comma-separated string, one per line, semi-colons from a European keyboard.
 * All of those get accepted, because rejecting a valid-looking paste is the
 * kind of friction that stops someone inviting their team.
 *
 * Returns the invalid fragments separately rather than throwing. Dropping them
 * silently would mean someone believes they invited someone they didn't.
 */

/**
 * Any whitespace or comma or semicolon.
 *
 * Single spaces included: an address can never contain one, so splitting on
 * them costs nothing and saves the case of two addresses pasted space-separated
 * — which would otherwise be read as one fragment, fail validation, and invite
 * nobody.
 */
const SEPARATORS = /[,;\s]+/

const emailSchema = z.email()

export interface ParsedEmails {
  /** Valid, normalised (trimmed + lowercased), de-duplicated. */
  emails: string[]
  /** Fragments that didn't look like an address. */
  invalid: string[]
}

export function parseEmailList(input: string): ParsedEmails {
  const fragments = input
    .split(SEPARATORS)
    .map((part) => part.trim())
    .filter(Boolean)

  const emails: string[] = []
  const invalid: string[] = []
  const seen = new Set<string>()

  for (const fragment of fragments) {
    const parsed = emailSchema.safeParse(fragment)
    if (!parsed.success) {
      invalid.push(fragment)
      continue
    }
    // Normalised so Ada@studio.com and ada@studio.com are one recipient
    // rather than two invites to the same person.
    const email = parsed.data.trim().toLowerCase()
    if (seen.has(email)) continue
    seen.add(email)
    emails.push(email)
  }

  return { emails, invalid }
}
