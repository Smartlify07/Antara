import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { user } from "./auth"
import { id } from "./shared"

/**
 * Browser push subscriptions (Web Push / VAPID). One row per browser that has
 * opted in to notifications, keyed to the account that opted in — a person who
 * signed in on their laptop and their phone holds two rows, and both ring when
 * an event lands for them.
 *
 * `endpoint` is the push service URL the browser hands back from
 * `pushManager.subscribe()`. It is globally unique to a subscription (the
 * browser derives it), so it is the natural upsert key: re-subscribing from the
 * same browser after a permission toggle updates the row in place rather than
 * piling up a second one. `p256dh` and `auth` are the encryption keys web-push
 * needs to sign the payload; they never leave the server.
 */
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    // Diagnostic only: which browser produced this row. Not read for sending.
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("push_subscriptions_endpoint_unique").on(t.endpoint),
    // Send resolves every subscription for a user in one scan.
    index("push_subscriptions_user_idx").on(t.userId),
  ]
)

export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect
