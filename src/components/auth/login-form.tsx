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
import { loginSchema, type LoginInput } from "@/lib/auth-schemas"

export function LoginForm() {
  const [serverError, setServerError] = useState<string | null>(null)
  // Set only when sign-in fails because the address is unverified. It gates
  // the inline resend: re-sending is only useful once we know the password
  // was correct, and showing it unconditionally would invite mail traffic
  // from anyone with an address.
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null)
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  async function onSubmit(values: LoginInput) {
    setServerError(null)
    setUnverifiedEmail(null)
    const { error } = await authClient.signIn.email({
      email: values.email.trim(),
      password: values.password,
    })
    if (error) {
      // Safe to special-case here, unlike signup: this code is only ever
      // returned once the password has already been proven correct, so it
      // reveals nothing an attacker didn't already have.
      if (error.code === "EMAIL_NOT_VERIFIED") {
        setServerError(
          "This address isn't confirmed yet. Check your inbox for the verification link."
        )
        setUnverifiedEmail(values.email.trim())
        return
      }
      // Generic message: don't reveal whether the email is registered.
      setServerError("Invalid email or password. Please try again.")
      return
    }

    // No navigation here on purpose. The session atom updating is what
    // triggers the redirect, and `LoginPage` owns it so there's a single
    // navigation to animate. Navigating from here as well raced that and
    // left one of the two untransitioned.
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
          <h1 className="text-2xl font-medium tracking-tighter">
            Welcome back
          </h1>
          <p className="text-sm tracking-tight text-balance text-muted-foreground">
            Log in to pick up where your team left off.
          </p>
        </div>

        {serverError && (
          <p
            role="alert"
            className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {serverError}
          </p>
        )}

        {unverifiedEmail && (
          <ResendVerification defaultEmail={unverifiedEmail} hideInput />
        )}

        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="login-email">Email</FieldLabel>
          <Input
            id="login-email"
            type="email"
            placeholder="ada@studio.com"
            autoComplete="email"
            aria-invalid={!!errors.email}
            {...form.register("email")}
          />
          <FieldError errors={[errors.email]} />
        </Field>

        <Field data-invalid={!!errors.password}>
          <FieldLabel htmlFor="login-password">Password</FieldLabel>
          <Input
            id="login-password"
            type="password"
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            {...form.register("password")}
          />
          <FieldError errors={[errors.password]} />
        </Field>

        <Field>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            {isSubmitting ? "Logging in…" : "Log in"}
          </Button>
        </Field>

        <FieldSeparator>Or continue with</FieldSeparator>

        <Field>
          <GoogleButton
            label="Continue with Google"
            onError={(message) => setServerError(message)}
          />
          <FieldDescription className="px-6 text-center">
            Don&apos;t have an account?{" "}
            <Link to="/signup" className="font-medium">
              Sign up
            </Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  )
}
