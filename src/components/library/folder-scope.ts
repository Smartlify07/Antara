import { useSyncExternalStore } from "react"

/**
 * The folder-card shortcut's scope, held in memory rather than the URL.
 *
 * Clicking a cutout opens that folder's shelf instantly from data the wall
 * already holds, and the house wants that transition to work through the
 * router without turning the address bar into the second source of truth —
 * the URL filters stay owned by the deep-link contract (a hand-typed
 * `?project=…` still reads the same shelf), while the card's click carries
 * its scope here.
 *
 * Module state with subscriptions: the click writes before it navigates, so
 * the index route's first render already knows the target. The SSR snapshot
 * is deliberately `null` — a fresh page load (or a redirect between
 * workspaces) always starts scope-less, and the getter never serves a
 * another request's state.
 */
export interface FolderScope {
  workspaceSlug: string
  projectId: string
}

let current: FolderScope | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

export function setLibraryFolderScope(workspaceSlug: string, projectId: string) {
  current = { workspaceSlug, projectId }
  emit()
}

export function clearLibraryFolderScope() {
  if (current) {
    current = null
    emit()
  }
}

export function getLibraryFolderScope(): FolderScope | null {
  return current
}

export function subscribeToLibraryFolderScope(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useLibraryFolderScope(): FolderScope | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => current,
    () => null
  )
}
