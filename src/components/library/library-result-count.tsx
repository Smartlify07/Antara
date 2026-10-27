/**
 * The match line under the filter row: "37 of 1,248 assets match your
 * filters" — the numbers that make search a place rather than a filter.
 *
 * It shows only when the two numbers disagree, i.e. when some filter word
 * actually narrowed the shelf: an unfiltered library IS the folder wall, and
 * a line counting the wall against itself is noise. `aria-live` keeps the
 * count spoken as it moves, since the number is the whole point of the line.
 */
export function LibraryResultCount({
  shown,
  total,
}: {
  /** The rows the filtered list returned. */
  shown: number
  /** The scope's size before any filter (the service's `total`). */
  total: number
}) {
  if (shown === total) return null

  return (
    <p className="text-xs text-muted-foreground" aria-live="polite">
      {shown.toLocaleString("en-US")} of {total.toLocaleString("en-US")}{" "}
      {total === 1 ? "asset" : "assets"} match
      {shown === 1 ? "es" : ""} your filters
    </p>
  )
}
