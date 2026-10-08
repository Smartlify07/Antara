import { Navigate, createFileRoute } from "@tanstack/react-router"
import { Loader2 } from "lucide-react"
import { AuthLayout } from "@/components/auth/auth-layout"
import { SignupForm } from "@/components/auth/signup-form"
import { useSession } from "@/lib/auth-client"

export const Route = createFileRoute("/signup")({
  component: SignupPage,
})

function SignupPage() {
  const { data, isPending } = useSession()

  // Keep the shell while the session resolves rather than returning null —
  // see the note in `login.tsx`. Signup never navigates from inside the
  // form (no session is created until the address is verified), so the
  // redirect below only ever fires for someone arriving already signed in.
  return (
    <AuthLayout>
      {isPending ? (
        <div className="flex min-h-40 items-center justify-center">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      ) : data?.session ? (
        <Navigate to="/dashboard" />
      ) : (
        <SignupForm />
      )}
    </AuthLayout>
  )
}
