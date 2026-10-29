import { useCallback, useEffect, useRef, useState } from "react"
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
 * The service worker is registered once per mount and its subscription is read
 * back to decide the initial state, so the toggle reflects reality (not just
 * what the user clicked last). Persisting the subscription is a server
 * round-trip (`savePushSubscriptionFn`), but the state flips optimistically and
 * the write is fire-and-forget — a failed write leaves the browser subscribed
 * but the server unaware, which only means that one browser stops getting
 * pushes until the toggle is cycled again.
 */

const PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

export type PushStatus =
  "unsupported" | "loading" | "denied" | "subscribed" | "unsubscribed"

export interface UsePush {
  status: PushStatus
  /** Push can work at all: a configured key plus a capable, secure browser. */
  supported: boolean
  denied: boolean
  subscribed: boolean
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
      if (subscription) setStatus("subscribed")
      else if (Notification.permission === "denied") setStatus("denied")
      else setStatus("unsubscribed")
    })
    return () => {
      cancelled = true
    }
  }, [register])

  const enable = useCallback(async () => {
    if (!isSupported()) return
    const registration = registrationRef.current ?? (await register())
    if (!registration) {
      setStatus("unsupported")
      return
    }
    registrationRef.current = registration

    const permission = await Notification.requestPermission()
    if (permission !== "granted") {
      setStatus("denied")
      return
    }

    const applicationServerKey = urlBase64ToUint8Array(PUBLIC_KEY)
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    })

    const json = subscription.toJSON()
    if (json.endpoint && json.keys?.p256dh && json.keys.auth) {
      void savePushSubscriptionFn({
        data: {
          endpoint: json.endpoint,
          keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        },
      })
    }
    setStatus("subscribed")
  }, [register])

  const disable = useCallback(async () => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return
    const registration = registrationRef.current ?? (await register())
    if (!registration) return
    registrationRef.current = registration

    const subscription = await registration.pushManager.getSubscription()
    if (subscription) {
      await subscription.unsubscribe()
      void removePushSubscriptionFn({
        data: { endpoint: subscription.endpoint },
      })
    }
    setStatus("unsubscribed")
  }, [register])

  return {
    status,
    supported: isSupported(),
    denied: status === "denied",
    subscribed: status === "subscribed",
    enable,
    disable,
  }
}
