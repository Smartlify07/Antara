/**
 * Tag dot colours.
 *
 * A tag's colour is stored on the row so a user-chosen colour survives. When
 * no colour is set, one is derived from the label — stable per label, so the
 * same tag keeps the same dot everywhere without writing to the database.
 */

/** Hand-picked hues that stay legible as a small dot on light and dark UI. */
export const TAG_COLORS = [
  "#e11d48", // rose
  "#ea580c", // orange
  "#ca8a04", // yellow
  "#16a34a", // green
  "#0d9488", // teal
  "#0284c7", // sky
  "#4f46e5", // indigo
  "#9333ea", // purple
  "#c026d3", // fuchsia
  "#64748b", // slate
] as const

function hash(value: string): number {
  let h = 2166136261
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Stable colour for a label, used whenever the row has none. */
export function tagColorFor(label: string): string {
  return TAG_COLORS[hash(label.trim().toLowerCase()) % TAG_COLORS.length]!
}

/** The stored colour when present, otherwise the derived fallback. */
export function resolveTagColor(color: string | null, label: string): string {
  return color?.trim() ? color : tagColorFor(label)
}
