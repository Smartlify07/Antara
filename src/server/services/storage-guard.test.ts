import { describe, expect, it } from "vitest"
import { toDeletionQueueEntry } from "./storage-guard"

/**
 * The upload-only deletion guard (plan decision #1), run without a database —
 * the contract that stops the cleanup worker from ever acting on a reference
 * into someone else's storage.
 */
describe("the upload-only deletion guard", () => {
  it("enqueues a hosted upload's provider reference", () => {
    expect(
      toDeletionQueueEntry({
        id: "v1",
        source: "upload",
        provider: "cloudinary",
        providerKey: "antara/keynotes.pdf",
      })
    ).toEqual({
      provider: "cloudinary",
      providerKey: "antara/keynotes.pdf",
      assetId: "v1",
    })
  })

  it("never enqueues an external link, whatever its row carries", () => {
    expect(
      toDeletionQueueEntry({
        id: "v2",
        source: "external_link",
        provider: "cloudinary",
        providerKey: "would-reach-into-cloudinary.pdf",
      })
    ).toBeNull()
    expect(
      toDeletionQueueEntry({
        id: "v3",
        source: "external_link",
        provider: null,
        providerKey: null,
      })
    ).toBeNull()
  })

  it("refuses an upload row that lost its provider fields", () => {
    expect(
      toDeletionQueueEntry({
        id: "v4",
        source: "upload",
        provider: null,
        providerKey: "some/key.pdf",
      })
    ).toBeNull()
    expect(
      toDeletionQueueEntry({
        id: "v5",
        source: "upload",
        provider: "aws",
        providerKey: null,
      })
    ).toBeNull()
  })
})
