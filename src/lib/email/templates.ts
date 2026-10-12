import { appOrigin } from "@/lib/app-origin"
import { emailShell, escapeHtml, sendEmail } from "./send"

/**
 * Email templates.
 *
 * `emailShell` escapes the title, the CTA label and the CTA URL itself, so
 * those are interpolated raw here — escaping them at the call site
 * double-escapes, and a value containing `&` or `<` renders as visible
 * `&amp;` text. The `body` is passed through as raw HTML by design, so
 * anything interpolated into it must be escaped by the caller.
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

/**
 * Workspace invite.
 *
 * `body` is raw HTML, so the workspace title and inviter name are escaped
 * here. The title and the CTA are not — `emailShell` does those, and escaping
 * them twice is the bug this file already had once.
 *
 * The inviter name is worth a second look: it is attribution, and the team
 * roster deliberately doesn't show it to non-admins. Putting it in an email
 * only widens that, so it's named rather than linked.
 */
export async function sendInviteEmail(params: {
  to: string
  workspaceTitle: string
  inviterName: string | null
  roleTitle: string
  token: string
  expiresAt: Date
}) {
  // Resolved here rather than passed in. This used to take an optional
  // `appUrl` that no caller ever supplied, so every production invite silently
  // fell back to a hardcoded `http://localhost:3000` and every link in the
  // email was dead. An optional argument nobody passes is a silent failure
  // waiting to happen; deriving it makes that impossible.
  const base = appOrigin()
  const url = `${base}/invite/${encodeURIComponent(params.token)}`

  const days = Math.max(
    1,
    Math.round((params.expiresAt.getTime() - Date.now()) / 86_400_000)
  )

  const roleLine =
    params.roleTitle === "Admin"
      ? "You'll join as an admin."
      : "You'll join as a member."

  const html = emailShell({
    title: `You're invited to ${params.workspaceTitle}`,
    body: [
      `<p style="margin:0 0 12px">${escapeHtml(
        params.inviterName
          ? `${params.inviterName} invited you to join ${params.workspaceTitle} on Antara.`
          : `You've been invited to join ${params.workspaceTitle} on Antara.`
      )}</p>`,
      `<p style="margin:0 0 12px">${roleLine}</p>`,
    ].join(""),
    cta: { label: "Accept invite", url },
    footer: `This invite expires in ${days} days. If you weren't expecting it, you can ignore this email — nothing happens until you accept.`,
  })

  return sendEmail({
    to: params.to,
    subject: `You're invited to ${params.workspaceTitle}`,
    html,
  })
}
