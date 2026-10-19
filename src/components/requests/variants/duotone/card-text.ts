/**
 * Card-local pure text helpers for the duotone variant. Kept out of the
 * card's JSX so the layout rules they encode are individually testable.
 */

/** A title longer than this fills both title lines — the brief excerpt would be noise. */
export const BRIEF_TITLE_BUDGET = 48

/**
 * The brief excerpt shows only when the title leaves room: a short title
 * keeps at least one line free, a long one eats the card. One deterministic
 * rule, applied to every card, so the clutter never flickers between cards.
 */
export function hasBriefRoom(title: string): boolean {
  return title.length <= BRIEF_TITLE_BUDGET
}

/** First grapheme of the requester name, uppercased; "?" when there is none. */
export function requesterInitial(name: string | null): string {
  const first = (name ?? "").trim().charAt(0)
  return first ? first.toUpperCase() : "?"
}

/** Message count label; callers gate the zero case. */
export function messagesLabel(count: number): string {
  return `${count} ${count === 1 ? "message" : "messages"}`
}
