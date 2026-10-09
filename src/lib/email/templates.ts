import { emailShell, sendEmail } from "./send"

/**
 * Email templates.
 *
 * `emailShell` escapes the title and the CTA URL itself, so those values are
 * interpolated raw here — escaping them at the call site double-escapes, and
 * a name containing `&` or `<` renders as visible `&amp;` text. The body is
 * passed through as raw HTML by design, so anything interpolated into it must
 * be escaped by the caller.
 */

const VERIFICATION_VALID_HOURS = 48

export async function sendVerificationEmail(params: {
  to: string
  name: string
  url: string
}) {
  const html = emailShell({
    title: `Confirm your email, ${params.name}`,
    body: `<p style="margin:0 0 12px">Welcome to Antara. Confirm this address to finish setting up your account.</p>`,
    cta: { label: "Confirm email", url: params.url },
    footer: `This link expires in ${VERIFICATION_VALID_HOURS} hours. If you didn't create an Antara account, you can ignore this email.`,
  })

  return sendEmail({
    to: params.to,
    subject: "Confirm your email",
    html,
  })
}

export { VERIFICATION_VALID_HOURS }
