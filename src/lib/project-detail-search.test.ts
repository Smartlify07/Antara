import { describe, expect, it } from "vitest"
import { parseProjectDetailSearch } from "./project-detail-search"

describe("parseProjectDetailSearch", () => {
  it("reads a full cabinet deep link", () => {
    expect(
      parseProjectDetailSearch({
        tab: "work",
        deliverable: "del-1",
        version: "version-9",
      })
    ).toEqual({
      tab: "work",
      deliverable: "del-1",
      version: "version-9",
    })
  })

  it("implies the Work tab when a deliverable is named", () => {
    expect(parseProjectDetailSearch({ deliverable: "del-1" })).toEqual({
      tab: "work",
      deliverable: "del-1",
      version: undefined,
    })
  })

  it("drops a version without its deliverable", () => {
    expect(parseProjectDetailSearch({ version: "version-9" })).toEqual({
      tab: undefined,
      deliverable: undefined,
      version: undefined,
    })
  })

  it("falls open on unknown tabs and blank params", () => {
    expect(
      parseProjectDetailSearch({ tab: "nope", deliverable: "  " })
    ).toEqual({
      tab: undefined,
      deliverable: undefined,
      version: undefined,
    })
  })
})
