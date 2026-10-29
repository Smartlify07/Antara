// Antara service worker — browser push notifications only.
//
// The payload is the JSON written by the server's push-send path:
// `{ title, body, url, tag }`. `url` is a root-relative deep link; on click we
// focus an already-open Antara tab and navigate it, or open a new one.

self.addEventListener("push", (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    // A malformed payload is not worth surfacing; fall back to a bare ping.
  }

  const { title = "Antara", body = "", url = "/", tag } = data

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      data: { url },
    })
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = event.notification.data?.url || "/"

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if ("focus" in client) {
            client.navigate(url)
            return client.focus()
          }
        }
        return clients.openWindow(url)
      })
  )
})
