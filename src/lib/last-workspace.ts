const LAST_WORKSPACE_KEY = "antara:last-workspace"

/**
 * Client-side memory of the last workspace the user opened. Used by
 * /dashboard to skip the workspace picker. Per-device by design.
 */
export function rememberWorkspace(slug: string) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(LAST_WORKSPACE_KEY, slug)
  } catch {
    // Storage can be unavailable (private mode, quota). Non-fatal.
  }
}

export function readLastWorkspace(): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage.getItem(LAST_WORKSPACE_KEY)
  } catch {
    return null
  }
}
