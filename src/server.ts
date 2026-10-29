import * as Sentry from "@sentry/tanstackstart-react"
import handler, {
  createServerEntry,
} from "@tanstack/react-start/server-entry"

/**
 * Custom server entry: wraps the TanStack Start handler with Sentry so server
 * functions and request handling are traced and errors are captured.
 *
 * `Sentry.init` is guarded on SENTRY_DSN so the server still boots when the key
 * is absent (placeholder `.env`). `wrapFetchWithSentry` is equally safe without
 * an initialized client — it degrades to a pass-through.
 */
const dsn = process.env.SENTRY_DSN
if (dsn) {
  Sentry.init({
    dsn,
    // Lower this in production; 100% traces is for bootstrapping.
    tracesSampleRate: 1.0,
  })
}

export default createServerEntry(
  Sentry.wrapFetchWithSentry({
    fetch(request: Request) {
      return handler.fetch(request)
    },
  })
)
