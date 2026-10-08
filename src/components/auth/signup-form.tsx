import { Link } from "@tanstack/react-router"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/logo"
import { GoogleButton } from "@/components/auth/google-button"
import { ResendVerification } from "@/components/auth/resend-verification"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { authClient } from "@/lib/auth-client"
import { signupSchema, type SignupInput } from "@/lib/auth-schemas"

/**
 * Shown for every signup outcome, whether or not the address was already
 * registered. This message must never vary: any difference between "new
 * user" and "existing user" is an account-enumeration oracle, letting
 * anyone script the user list straight off this endpoint. The response is
 * non-committal because signup always sends a verification email now —
 * the mailbox, not this text, is what confirms the address.
 */
const SIGNUP_MESSAGE =
  "Check your inbox — if that address can be used, you'll get a verification link shortly."

export function SignupForm() {
  const [done, setDone] = useState(false)
  const [sentTo, setSentTo] = useState("")
  const [serverError, setServerError] = useState<string | null>(null)
  const form = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  })

  async function onSubmit(values: SignupInput) {
    setServerError(null)
    setDone(false)
    const { error } = await authClient.signUp.email({
      name: values.name.trim(),
      email: values.email.trim(),
      password: values.password,
      // Where the emailed link lands once its token is consumed. Without
      // this better-auth defaults to "/", which drops the user on the
      // marketing page with no confirmation that anything happened.
      callbackURL: "/verify-email",
    })

    // Any outcome shows the same message. Branching on `error` would leak
    // which addresses are registered.
    void error
    setSentTo(values.email.trim())
    setDone(true)
  }

  const { errors, isSubmitting } = form.formState

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex flex-col gap-6"
      noValidate
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-2 text-center">
          <Logo className="size-10 text-primary" />
          <h1 className="font-sans text-2xl font-medium tracking-tighter">
            Create your account
          </h1>
          <p className="text-sm tracking-tight text-balance text-muted-foreground">
            Set up your Antara workspace in under a minute.
          </p>
        </div>

        {done ? (
          <>
            <p role="status" className="rounded-lg bg-muted px-3 py-2 text-sm">
              {SIGNUP_MESSAGE}
            </p>
            <ResendVerification defaultEmail={sentTo} hideInput />
            <FieldDescription className="px-6 text-center">
              Already verified?{" "}
              <Link to="/login" className="font-medium">
                Log in
              </Link>
            </FieldDescription>
          </>
        ) : (
          <>
            {serverError && (
              <p
                role="alert"
                className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {serverError}
              </p>
            )}

            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="signup-name">Full name</FieldLabel>
              <Input
                id="signup-name"
                type="text"
                placeholder="Ada Lovelace"
                autoComplete="name"
                aria-invalid={!!errors.name}
                {...form.register("name")}
              />
              <FieldError errors={[errors.name]} />
            </Field>

            <Field data-invalid={!!errors.email}>
              <FieldLabel htmlFor="signup-email">Email</FieldLabel>
              <Input
                id="signup-email"
                type="email"
                placeholder="ada@studio.com"
                autoComplete="email"
                aria-invalid={!!errors.email}
                {...form.register("email")}
              />
              <FieldError errors={[errors.email]} />
            </Field>

            <Field data-invalid={!!errors.password}>
              <FieldLabel htmlFor="signup-password">Password</FieldLabel>
              <Input
                id="signup-password"
                type="password"
                autoComplete="new-password"
                aria-invalid={!!errors.password}
                {...form.register("password")}
              />
              <FieldDescription>
                Must be at least 8 characters long.
              </FieldDescription>
              <FieldError errors={[errors.password]} />
            </Field>

            <Field data-invalid={!!errors.confirmPassword}>
              <FieldLabel htmlFor="signup-confirm">Confirm password</FieldLabel>
              <Input
                id="signup-confirm"
                type="password"
                autoComplete="new-password"
                aria-invalid={!!errors.confirmPassword}
                {...form.register("confirmPassword")}
              />
              <FieldError errors={[errors.confirmPassword]} />
            </Field>

            <Field>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="animate-spin" />}
                {isSubmitting ? "Creating account…" : "Create account"}
              </Button>
            </Field>

            <FieldSeparator>Or continue with</FieldSeparator>

            <Field>
              <GoogleButton
                label="Continue with Google"
                onError={(message) => setServerError(message)}
              />
              <FieldDescription className="px-6 text-center">
                Already have an account?{" "}
                <Link to="/login" className="font-medium">
                  Log in
                </Link>
              </FieldDescription>
            </Field>
          </>
        )}
      </FieldGroup>
    </form>
  )
}
