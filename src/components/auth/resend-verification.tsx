import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { resendVerificationEmail } from "@/lib/auth-client"
import { resendSchema, type ResendInput } from "@/lib/auth-schemas"

/**
 * Shown after every send attempt, whether or not it worked. This must never
 * vary by outcome — the address might be registered, unregistered, or already
 * verified, and saying which turns this into a user-enumeration oracle.
 */
const RESEND_MESSAGE =
  "If that address needs verifying, we've sent it a fresh link."

interface ResendVerificationProps {
  /** Pre-fills the field. Required when `hideInput` is set. */
  defaultEmail?: string
  /**
   * Renders just a button, for contexts that already know the address (the
   * signup confirmation, the sign-in form) and shouldn't ask twice.
   */
  hideInput?: boolean
  className?: string
}

/**
 * Requests another verification email. Used on the signup and sign-in
 * screens and on the `/verify-email` landing page.
 *
 * Failures report the same neutral message as successes. That isn't only
 * caution: when the email provider is misconfigured the endpoint throws for a
 * real address and returns 200 for a nonexistent one, so branching on the
 * error here would leak which addresses exist precisely when delivery is
 * broken.
 */
export function ResendVerification({
  defaultEmail = "",
  hideInput = false,
  className,
}: ResendVerificationProps) {
  const form = useForm<ResendInput>({
    resolver: zodResolver(resendSchema),
    defaultValues: { email: defaultEmail },
  })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  async function send(email: string) {
    const { error } = await resendVerificationEmail(email)
    // Swallowed on purpose — see the note above.
    void error
  }

  async function onSubmit(values: ResendInput) {
    await send(values.email)
  }

  // With `hideInput` the address is already known and there's nothing to
  // validate, so skip the form entirely rather than pushing a single field
  // through a resolver.
  async function onDirectSubmit() {
    setSending(true)
    await send(defaultEmail)
    setSending(false)
    setSent(true)
  }

  const { errors, isSubmitting, isSubmitSuccessful } = form.formState
  const busy = isSubmitting || sending
  const shown = isSubmitSuccessful || sent

  if (hideInput) {
    return (
      <div className={className}>
        {shown && (
          <p role="status" className="mb-2 text-sm text-muted-foreground">
            {RESEND_MESSAGE}
          </p>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => void onDirectSubmit()}
        >
          {busy && <Loader2 className="animate-spin" />}
          {busy ? "Sending…" : "Didn't get it? Send another link"}
        </Button>
      </div>
    )
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className={className}
      noValidate
    >
      {shown && (
        <p role="status" className="mb-3 rounded-lg bg-muted px-3 py-2 text-sm">
          {RESEND_MESSAGE}
        </p>
      )}

      <Field data-invalid={!!errors.email}>
        <FieldLabel htmlFor="resend-email">Email</FieldLabel>
        <Input
          id="resend-email"
          type="email"
          placeholder="ada@studio.com"
          autoComplete="email"
          aria-invalid={!!errors.email}
          {...form.register("email")}
        />
        <FieldError errors={[errors.email]} />
        <FieldDescription className="mt-3">
          <Button type="submit" size="sm" disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            {busy ? "Sending…" : "Send verification link"}
          </Button>
        </FieldDescription>
      </Field>
    </form>
  )
}
