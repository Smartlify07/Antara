import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_BETTER_AUTH_URL,
})

export const { signIn, signUp, signOut, useSession } = authClient

/**
 * Re-sends the verification email. Exposed because `requireEmailVerification`
 * gates sign-in: someone who never received (or lost) the original needs a
 * way to get another without creating a second account.
 */
export async function resendVerificationEmail(email: string) {
  return authClient.sendVerificationEmail({ email, callbackURL: "/login" })
}
