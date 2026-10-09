import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { db } from "@/db"
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
