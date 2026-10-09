import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_BETTER_AUTH_URL,
})

export const { signIn, signUp, signOut, useSession } = authClient

/**
 * Re-sends the verification email. Exposed because `requireEmailVerification`
 * gates sign-in: someone who never received (or lost) the original needs a
 * way to get another without creating a second account.
 *
 * This is the *only* recovery path. Re-submitting the signup form won't do
 * it — with `requireEmailVerification` set, an existing address takes
 * better-auth's generic duplicate branch, which returns a synthetic user and
 * sends nothing. And sign-in is blocked until the address is verified, so
 * the form can't even show a useful error.
 *
 * callbackURL is the landing page the emailed link redirects to once the
 * token is consumed, so it must be `/verify-email` rather than `/login`.
 */
export async function resendVerificationEmail(email: string) {
  return authClient.sendVerificationEmail({
    email: email.trim(),
    callbackURL: "/verify-email",
  })
}
