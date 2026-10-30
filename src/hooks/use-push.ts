import { useCallback, useEffect, useRef, useState } from "react"
import { serializeSubscription } from "@/lib/push-client"
import { urlBase64ToUint8Array } from "@/lib/push-encoding"
import {
  removePushSubscriptionFn,
  savePushSubscriptionFn,
} from "@/server/functions/push"

/**
 * Browser push opt-in. Wraps the Web Push primitives — service worker
 * registration, permission, and subscription — behind a small state machine
 * the settings screen renders as a single switch.
 *
 * Two rules keep the toggle honest:
 *
 * - The switch only reads "on" once the server has the subscription. A local
 *   subscription the server never stored is a browser that will silently
 *   receive nothing, so a failed write turns the switch back off and explains
 *   itself instead of pretending.
 * - Mount re-saves an existing subscription, which repairs a browser whose row
 *   was lost (a write that failed, or a row pruned after a 410).
 */

const PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

const SAVE_FAILED =
  "Couldn't save this browser for notifications. Please try again."
const REMOVE_FAILED =
  "Couldn't turn notifications off in this browser. Please try again."

export type PushStatus =
  "unsupported" | "loading" | "denied" | "subscribed" | "unsubscribed"

export interface UsePush {
  status: PushStatus
  /** Push can work at all: a configured key plus a capable, secure browser. */
  supported: boolean
  denied: boolean
  subscribed: boolean
  /** Last user-facing failure; null when the toggle is in a clean state. */
  error: string | null
  enable: () => Promise<void>
  disable: () => Promise<void>
}

function isSupported(): boolean {
  // SSR guard: the server has no `window`/`navigator`, and this hook renders
  // inside the settings route which is server-rendered.
  if (typeof window === "undefined") return false
  return (
    Boolean(PUBLIC_KEY) &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  )
}

export function usePush(): UsePush {
  const [status, setStatus] = useState<PushStatus>(() =>
    isSupported() ? "loading" : "unsupported"
  )
  const [error, setError] = useState<string | null>(null)
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null)

  const register =
    useCallback(async (): Promise<ServiceWorkerRegistration | null> => {
      if (!("serviceWorker" in navigator)) return null
      try {
        return await navigator.serviceWorker.register("/sw.js")
      } catch {
        return null
      }
    }, [])

  const persist = useCallback(async (subscription: PushSubscription) => {
    const serialized = serializeSubscription(subscription)
    if (!serialized) throw new Error(SAVE_FAILED)
    await savePushSubscriptionFn({ data: serialized })
  }, [])

  useEffect(() => {
    if (!isSupported()) return
    let cancelled = false
    void register().then(async (registration) => {
      if (!registration) {
        if (!cancelled) setStatus("unsupported")
        return
      }
      registrationRef.current = registration
      const subscription = await registration.pushManager.getSubscription()
      if (cancelled) return
      if (subscription) {
        setStatus("subscribed")
        try {
          await persist(subscription)
        } catch {
          setError(SAVE_FAILED)
        }
      } else if (Notification.permission === "denied") setStatus("denied")
      else setStatus("unsubscribed")
    })
    return () => {
      cancelled = true
    }
  }, [persist, register])

  const enable = useCallback(async () => {
    if (!isSupported()) return
    setError(null)

    // Ask before anything else: Firefox drops the prompt once the click's
    // transient activation has been spent on an await.
    const permission = await Notification.requestPermission()
    if (permission !== "granted") {
      setStatus("denied")
      return
    }

    const registration = registrationRef.current ?? (await register())
    if (!registration) {
      setStatus("unsupported")
      return
    }
    registrationRef.current = registration

    try {
      const existing = await registration.pushManager.getSubscription()
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY),
        }))
      await persist(subscription)
      setStatus("subscribed")
    } catch {
      // Never leave the browser subscribed to a feed the server can't address.
      setStatus("unsubscribed")
      setError(SAVE_FAILED)
      try {
        ;(await registration.pushManager.getSubscription())?.unsubscribe()
      } catch {
        // Best effort — the switch is already off and the reason is shown.
      }
    }
  }, [persist, register])

  const disable = useCallback(async () => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return
    setError(null)
    const registration = registrationRef.current ?? (await register())
    if (!registration) return
    registrationRef.current = registration

    try {
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        await subscription.unsubscribe()
        await removePushSubscriptionFn({
          data: { endpoint: subscription.endpoint },
        })
      }
      setStatus("unsubscribed")
    } catch {
      setError(REMOVE_FAILED)
    }
  }, [register])

  return {
    status,
    supported: isSupported(),
    denied: status === "denied",
    subscribed: status === "subscribed",
    error,
    enable,
    disable,
  }
}
