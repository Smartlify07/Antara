import type { AssetProvider, AssetVersionSource } from "@/db/enums"

/**
 * THE upload-only enqueue guard (plan decision #1), shared by every deletion
 * path. Pure like the permission predicates and the workflow machine — the
 * DB layers call it, and its contract is run without a database in
 * `storage-guard.test.ts`.
 *
 * A hosted upload becomes its queue entry; an `external_link` produces none,
 * because its file lives on storage Antara does not own and the deletion
 * worker must never act on such a reference. Also covers the shape-check
 * hole the `source` column documents: an upload missing its provider keys
 * is not enqueable either.
 */

export interface StorageDeletionEntry {
  provider: "cloudinary" | "aws"
  providerKey: string
  assetId: string
}

export function toDeletionQueueEntry(version: {
  id: string
  source: AssetVersionSource
  provider: AssetProvider | null
  providerKey: string | null
}): StorageDeletionEntry | null {
  // The asset row still goes — the queue is about bytes.
  if (version.source !== "upload") return null
  if (version.provider === null || version.providerKey === null) return null
  return {
    provider: version.provider,
    providerKey: version.providerKey,
    // The queue keys on the version row (the bytes), though the column
    // keeps the historical `asset_id` name.
    assetId: version.id,
  }
}
