/**
 * FNV-1a 32-bit string hash.
 *
 * Stable across runs and platforms, so a colour derived from a seed (a tag
 * label, a user id, a project slug, an asset id) stays the same everywhere
 * without writing it to the database.
 */
export function hash(value: string): number {
  let h = 2166136261
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
