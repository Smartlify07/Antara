import { emailShell, escapeHtml, sendEmail } from "./send"

/**
 * Email templates. Values are escaped at the point of interpolation, so
 * caller-supplied strings (names, workspace titles) cannot inject markup
 * into our own mail.
 */

const VERIFICATION_VALID_HOURS = 48

export async function sendVerificationEmail(params: {
  to: string
  name: string
  url: string
}) {
  const html = emailShell({
    title: `Confirm your email, ${escapeHtml(params.name)}`,
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
