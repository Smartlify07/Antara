/**
 * View Transitions for programmatic navigation.
 *
 * `document.startViewTransition` snapshots the DOM, runs the callback, then
 * animates old -> new. TanStack Router navigations are async: the loader
 * resolves and React commits *after* `history.push` returns, so the callback
 * must return the navigation promise or the transition captures two
 * identical frames.
 *
 * This wraps the call sites where a navigation is awaited (sign-in,
 * redirects) rather than patching `router.history`. Patching history looked
 * comprehensive but broke navigation outright — see the `this`-binding note
 * below — and could not wait on the async commit regardless.
 *
 * Limitation: `<Link>` clicks are not animated. They are synchronous from
 * the caller's perspective, and intercepting them means either a router-level
 * hook or wrapping every link.
 */

interface ViewTransition {
  ready: Promise<void>
  finished: Promise<void>
  updateCallbackDone: Promise<void>
}

type DocumentWithTransitions = Document & {
  startViewTransition?: (callback: () => unknown) => ViewTransition
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false
  return (
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
  )
}

export async function navigateWithTransition<T>(
  navigate: () => Promise<T>
): Promise<T> {
  if (typeof document === "undefined") return navigate()

  const doc = document as DocumentWithTransitions

  // Safari and Firefox have no View Transitions API; navigate normally.
  if (typeof doc.startViewTransition !== "function") return navigate()
  if (prefersReducedMotion()) return navigate()

  let result: T

  let transition: ViewTransition
  try {
    // Called as a method so the receiver stays the document. Assigning
    // `document.startViewTransition` to a variable and calling it detached
    // throws "Illegal invocation".
    transition = doc.startViewTransition(() => {
      result = navigate() as T
      // Returning the promise lets the browser wait for the async commit
      // before capturing the "new" frame.
      return result
    })
  } catch {
    // A transition must never be able to break navigation.
    return navigate()
  }

  // Rejects when the navigation rejects, so callers keep their existing
  // error handling untouched.
  await transition.updateCallbackDone
  // Animation end only; a skipped transition is not a navigation failure.
  await transition.finished.catch(() => undefined)

  return result!
}
