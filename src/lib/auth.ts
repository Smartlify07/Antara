import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { db } from "@/db"
import { appOrigin } from "@/lib/app-origin"
import { sendVerificationEmail } from "@/lib/email/templates"
import { normalizeEmail } from "@/lib/normalize-email"

/**
 * Production origin. Keep this explicit rather than letting better-auth
 * derive it from the request — a wildcard entry (e.g. https://*.vercel.app)
 * would let any Vercel project, anywhere, reach our auth endpoints.
 */
const PROD_ORIGIN = "https://antara-lyart.vercel.app"

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),

  // Explicit, so verification links do not depend on `BETTER_AUTH_URL` being
  // correctly populated. It was set to the empty string in production, which is
  // a *set* variable — better-auth accepted it and fell back to its own
  // localhost default, so every verification email contained a dead link while
  // the app itself worked fine.
  //
  // Same resolver as the invite email, so both link types come from one place
  // and neither can drift. Throws in production if unresolved, rather than
  // silently emitting localhost.
  baseURL: appOrigin(),

  trustedOrigins: [PROD_ORIGIN],

  emailAndPassword: {
    enabled: true,
    // Gates sign-in on a verified address. Without this, anyone can register
    // as an invited address and claim the invite before the real recipient.
    requireEmailVerification: true,
  },

  emailVerification: {
    sendOnSignUp: true,
    expiresIn: 60 * 60 * 48, // 48 hours
    // Must be explicit. better-auth documents no default for this, and the
    // handler is `if (options?.autoSignInAfterVerification)` — so leaving it
    // unset means no session is created and the user is still anonymous after
    // verifying. /verify-email decides where to send people by reading the
    // session, so without this it can't tell a success from a bare visit.
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      // Deliberately not awaited and never allowed to throw: a provider
      // failure must not turn into a distinguishable signup response.
      void sendVerificationEmail({ to: user.email, name: user.name, url })
    },
    // Attaches a freshly-confirmed account to any seat an admin reserved for
    // that address.
    //
    // Hooked on verification rather than on sign-up, and that is the whole
    // security argument for this feature. A seat exists for an address that
    // may have no account yet, so *registering* that address succeeds — anyone
    // can claim it. Only confirmation proves the caller controls the mailbox,
    // so this fires on `emailVerified` becoming true and nowhere earlier.
    //
    // Resolves identity only. The seat stays pending until the invite link is
    // actually redeemed, so someone who verifies before clicking still has a
    // link worth clicking.
    afterEmailVerification: async (user) => {
      try {
        // Imported lazily on purpose. A static import here pulls the service
        // — and anything it reaches — into the client graph, because
        // server-function modules import this file and route files import
        // those. `invite-token` is built on Web Crypto now rather than
        // `node:crypto`, so this is belt and braces rather than the only
        // thing standing between us and a dead form.
        const { backfillSeatsForVerifiedUser } =
          await import("@/server/services/invite-service")
        await backfillSeatsForVerifiedUser(user.id, user.email)
      } catch (error) {
        // Never surfaced to the caller: it would turn verification into a
        // distinguishable failure and break the sign-in handoff. The seat
        // stays pending and is claimed at accept time instead.
        console.error("[invites] seat backfill failed:", error)
      }
    },
  },

  // Counters live in Postgres so limits hold across serverless instances;
  // the default in-memory store is per-process and resets on cold start.
  rateLimit: {
    storage: "database",
    customRules: {
      // The signup endpoint is an enumeration vector, so keep it tight.
      "/sign-up/email": { window: 60, max: 5 },
      "/sign-in/email": { window: 60, max: 10 },
      // Tighter than sign-in because every hit costs an outbound send. Keyed
      // per-IP by better-auth, which bounds how much mail one caller can
      // trigger but not how many distinct recipients they can aim it at.
      "/send-verification-email": { window: 60, max: 3 },
    },
  },

  databaseHooks: {
    user: {
      create: {
        before: async (user) => ({
          data: { ...user, email: normalizeEmail(user.email) },
        }),
        after: async (user) => {
          // Imported lazily on purpose — see the note in `afterEmailVerification`.
          // A static import here would pull posthog-node into the client graph.
          try {
            const { captureServerEvent } = await import(
              "@/server/services/analytics"
            )
            captureServerEvent({
              distinctId: user.id,
              event: "user_signed_up",
              properties: { email: user.email, name: user.name },
            })
          } catch (error) {
            console.error("[analytics] signup event failed:", error)
          }
        },
      },
    },
    session: {
      create: {
        after: async (session) => {
          try {
            const { captureServerEvent } = await import(
              "@/server/services/analytics"
            )
            captureServerEvent({
              distinctId: session.userId,
              event: "user_signed_in",
            })
          } catch (error) {
            console.error("[analytics] sign-in event failed:", error)
          }
        },
      },
    },
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
})

export type Auth = typeof auth
