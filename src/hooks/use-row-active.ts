import { useState } from "react"

/**
 * Hover/focus engagement for a nav row — drives the animated icon without
 * the row knowing about the animation. Spread `activeProps` on the row.
 */
export function useRowActive() {
  const [active, setActive] = useState(false)
  return {
    active,
    activeProps: {
      onMouseEnter: () => setActive(true),
      onMouseLeave: () => setActive(false),
      onFocus: () => setActive(true),
      onBlur: () => setActive(false),
    },
  }
}
