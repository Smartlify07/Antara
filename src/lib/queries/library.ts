import { queryOptions } from "@tanstack/react-query"
import { getLibraryAssetFn, listLibraryFn } from "@/server/functions/library"
import type { LibraryFiltersInput } from "@/lib/library-schemas"

/**
 * Query keys for the Library (FR-039..044). The list carries its filters
 * under the key — a key can never drift from the inputs its fetcher needs —
 * and the detail is keyed by asset id, so one asset repaints without
 * dragging the list back on the wire.
 */
export const libraryKeys = {
  all: ["library"] as const,
  list: (workspaceId: string, filters: LibraryFiltersInput) =>
    ["library", "list", workspaceId, filters] as const,
  asset: (assetId: string) => ["library", "asset", assetId] as const,
}

/** The workspace's assets under the given filters — search, type, project / deliverable, approval state. */
export function libraryQuery(
  workspaceId: string,
  filters: Omit<LibraryFiltersInput, "workspaceId">
) {
  const payload: LibraryFiltersInput = { workspaceId, ...filters }
  return queryOptions({
    queryKey: libraryKeys.list(workspaceId, payload),
    queryFn: () => listLibraryFn({ data: payload }),
  })
}

/** One asset's detail: version timeline and the append-only decisions. */
export function libraryAssetQuery(workspaceId: string, assetId: string) {
  return queryOptions({
    queryKey: libraryKeys.asset(assetId),
    queryFn: () => getLibraryAssetFn({ data: { workspaceId, assetId } }),
  })
}
