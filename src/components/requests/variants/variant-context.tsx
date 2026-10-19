/**
 * Variant switching for the request inbox: the flag mechanics are dumb by
 * design. The page resolves the id once (URL param > localStorage > default,
 * persisted), passes it down here, and the switcher re-resolves. No
 * analytics, no workspace setting — this flag exists for seeing and picking
 * while a design converges.
 */
import { createContext, useContext } from "react"

export type RequestVariantValue = {
  variant: string
  setVariant: (id: string) => void
}

const RequestVariantContext = createContext<RequestVariantValue>({
  variant: "",
  setVariant: () => {},
})

export function RequestVariantProvider({
  variant,
  setVariant,
  children,
}: RequestVariantValue & { children?: React.ReactNode }) {
  return (
    <RequestVariantContext.Provider value={{ variant, setVariant }}>
      {children}
    </RequestVariantContext.Provider>
  )
}

/** Which variant the inbox below should render. */
export function useRequestVariant(): RequestVariantValue {
  return useContext(RequestVariantContext)
}

/** Where the pinned choice lives between visits. */
export const VARIANT_STORAGE_KEY = "antara.requestVariant"

export function persistVariant(id: string) {
  try {
    localStorage.setItem(VARIANT_STORAGE_KEY, id)
  } catch {
    // Private-mode storage failures must not break the page.
  }
}

export function readStoredVariant(): string | null {
  try {
    return localStorage.getItem(VARIANT_STORAGE_KEY)
  } catch {
    return null
  }
}
