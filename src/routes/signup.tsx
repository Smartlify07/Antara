import { Navigate, createFileRoute } from "@tanstack/react-router"
import { AuthLayout } from "@/components/auth/auth-layout"
import { AuthPending } from "@/components/auth/auth-pending"
import { SignupForm } from "@/components/auth/signup-form"
import { useAuthStatus } from "@/lib/use-auth-status"

export const Route = createFileRoute("/signup")({
  component: SignupPage,
})

function SignupPage() {
  // Latched status, not `useSession().isPending`. Gating on the raw flag let a
  // background refetch swap this subtree for a spinner and remount it, which
  // discarded the completed-signup state and put an empty form back on
  // screen. See `useAuthStatus`.
  const status = useAuthStatus()

  // Signup never navigates from inside the form — no session exists until the
  // address is verified — so this only fires for someone arriving signed in.
  return (
    <AuthLayout>
      {status === "pending" ? (
        <AuthPending />
      ) : status === "authenticated" ? (
        <Navigate to="/dashboard" />
      ) : (
        <SignupForm />
      )}
    </AuthLayout>
  )
}
