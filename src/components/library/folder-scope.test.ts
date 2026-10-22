import { afterEach, describe, expect, it, vi } from "vitest"
import {
  clearLibraryFolderScope,
  getLibraryFolderScope,
  setLibraryFolderScope,
  subscribeToLibraryFolderScope,
} from "./folder-scope"

/**
 * The click-driven scope's module contract: the cutout's click writes before
 * it navigates, another folder's click replaces the first, and the clear
 * (back link, any filter patch) returns the library to the wall. Listeners
 * hear exactly the moves that change the answer, so the index route
 * re-renders only on real transitions.
 */
describe("folder-scope", () => {
  afterEach(() => {
    clearLibraryFolderScope()
  })

  it("reports the clicked folder, another click replaces it", () => {
    setLibraryFolderScope("jee-ho-va", "project-a")
    expect(getLibraryFolderScope()).toEqual({
      workspaceSlug: "jee-ho-va",
      projectId: "project-a",
    })
    setLibraryFolderScope("jee-ho-va", "project-b")
    expect(getLibraryFolderScope()).toEqual({
      workspaceSlug: "jee-ho-va",
      projectId: "project-b",
    })
  })

  it("clears back to nothing so a fresh mount shows the wall", () => {
    setLibraryFolderScope("jee-ho-va", "project-a")
    clearLibraryFolderScope()
    expect(getLibraryFolderScope()).toBeNull()
  })

  it("notifies listeners on change, and a clear of nothing is silent", () => {
    const listener = vi.fn()
    const unsubscribe = subscribeToLibraryFolderScope(listener)
    setLibraryFolderScope("jee-ho-va", "project-a")
    clearLibraryFolderScope()
    clearLibraryFolderScope() // already nothing â€” the wall stays put
    expect(listener).toHaveBeenCalledTimes(2)
    unsubscribe()
    setLibraryFolderScope("jee-ho-va", "project-b")
    expect(listener).toHaveBeenCalledTimes(2)
  })
})
