/**
 * Transactional email via Resend.
 *
 * Every send is fail-soft by design. `sendEmail` never throws and never
 * reports failure to the caller, because these sends sit on paths where a
 * thrown error would produce a *distinguishable* response and become an
 * account-enumeration oracle. A dropped verification email is an
 * inconvenience; a leaked user list is a breach.
 *
 * API key is server-only. Never read RESEND_API_KEY from a VITE_ variable —
 * those are bundled into the client.
 */

const FROM_ADDRESS =
  process.env.EMAIL_FROM ?? "Antara <no-reply@updates.antara.app>"

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export interface SendResult {
  sent: boolean
  error?: string
}

/**
 * Sends an HTML email. Returns whether it was delivered, but callers
 * should almost always ignore that — see the note above.
 */
export async function sendEmail(params: {
  to: string
  subject: string
  html: string
}): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY

  if (!apiKey) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[email] RESEND_API_KEY not set — skipping "${params.subject}" to ${params.to}`
      )
    } else {
      console.error("[email] RESEND_API_KEY missing in production")
    }
    return { sent: false, error: "RESEND_API_KEY not configured" }
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [params.to],
        subject: params.subject,
        html: params.html,
      }),
    })

    if (!response.ok) {
      // Log server-side only. Provider details must never reach the client,
      // where they could hint at whether an address is deliverable.
      const detail = await response.text().catch(() => "")
      console.error(
        `[email] send failed (${response.status}) to ${params.to}: ${detail.slice(0, 300)}`
      )
      return { sent: false, error: `Provider responded ${response.status}` }
    }

    return { sent: true }
  } catch (error) {
    console.error(
      `[email] send threw to ${params.to}:`,
      error instanceof Error ? error.message : error
    )
    return { sent: false, error: "Network or provider failure" }
  }
}

export function emailShell(options: {
  title: string
  body: string
  cta?: { label: string; url: string }
  footer?: string
}): string {
  const { title, body, cta, footer } = options

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;color:#0a0a0a">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;padding:32px 16px">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;padding:32px">
            <tr><td>
              <p style="margin:0 0 24px;font-size:13px;font-weight:600;letter-spacing:-0.01em">antara</p>
              <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;font-weight:500">${escapeHtml(title)}</h1>
              <div style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#525252">${body}</div>
              ${
                cta
                  ? `<a href="${escapeHtml(cta.url)}" style="display:inline-block;background:#0a0a0a;color:#ffffff;text-decoration:none;font-size:14px;font-weight:500;padding:10px 18px;border-radius:8px">${escapeHtml(cta.label)}</a>`
                  : ""
              }
              ${
                footer
                  ? `<p style="margin:32px 0 0;font-size:12px;line-height:1.5;color:#8a8a8a">${footer}</p>`
                  : ""
              }
            </td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}
