/**
 * Person display helpers shared by avatars, chips, threads and the library.
 *
 * A "person" is anything carrying a name and/or email — a workspace member,
 * a deliverable owner ref, a comment author, a version submitter, or a former
 * account. Keeping the derivation here means every surface renders the same
 * initials and the same fallback.
 */

export interface PersonName {
  name: string | null
  email: string | null
}

/** Up to two initials from a name, falling back to the email's first letter. */
export function initials(name: string | null, email?: string | null): string {
  const fromName = name
    ?.split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
  return fromName || (email?.[0] ?? "?").toUpperCase()
}

/** One leading initial — for compact thread avatars. */
export function initial(name: string | null, email?: string | null): string {
  const source = name?.trim() || email?.trim() || ""
  return source ? source[0]!.toUpperCase() : "?"
}

/** A named person, an addressable email, or a caller-supplied fallback. */
export function displayName(person: PersonName, fallback = "Unknown"): string {
  return person.name ?? person.email ?? fallback
}
