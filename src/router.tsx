import * as Sentry from "@sentry/tanstackstart-react"
import { createRouter as createTanStackRouter } from "@tanstack/react-router"
import { routeTree } from "./routeTree.gen"

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,

    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
  })

  // Sentry client SDK: errors, route tracing, and session replay. Guarded on
  // both the browser and a configured DSN, so SSR and a placeholder `.env`
  // never initialize it.
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (typeof window !== "undefined" && dsn) {
    Sentry.init({
      dsn,
      integrations: [
        Sentry.tanstackRouterBrowserTracingIntegration(router),
        Sentry.replayIntegration(),
      ],
      // Lower these in production; 100% traces is for bootstrapping.
      tracesSampleRate: 1.0,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
    })
  }

  return router
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
