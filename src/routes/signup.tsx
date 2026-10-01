import { Navigate, createFileRoute } from "@tanstack/react-router"
import { AuthLayout } from "@/components/auth/auth-layout"
import { SignupForm } from "@/components/auth/signup-form"
import { useSession } from "@/lib/auth-client"

export const Route = createFileRoute("/signup")({
  component: SignupPage,
})

function SignupPage() {
  const { data, isPending } = useSession()

  if (isPending) return null
  if (data?.session) return <Navigate to="/dashboard" />

  return (
    <AuthLayout>
      <SignupForm />
    </AuthLayout>
  )
}
