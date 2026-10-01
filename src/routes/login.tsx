import { Navigate, createFileRoute } from "@tanstack/react-router"
import { AuthLayout } from "@/components/auth/auth-layout"
import { LoginForm } from "@/components/auth/login-form"
import { useSession } from "@/lib/auth-client"

export const Route = createFileRoute("/login")({
  component: LoginPage,
})

function LoginPage() {
  const { data, isPending } = useSession()

  if (isPending) return null
  if (data?.session) return <Navigate to="/dashboard" />

  return (
    <AuthLayout>
      <LoginForm />
    </AuthLayout>
  )
}
