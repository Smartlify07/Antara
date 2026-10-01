import { Navigate, createFileRoute } from "@tanstack/react-router"
import { AuthLayout } from "@/components/auth/auth-layout"
import { WorkspaceForm } from "@/components/workspaces/workspace-form"
import { useSession } from "@/lib/auth-client"

export const Route = createFileRoute("/workspaces/new")({
  component: NewWorkspacePage,
})

function NewWorkspacePage() {
  const { data, isPending } = useSession()

  if (isPending) return null
  if (!data?.session) return <Navigate to="/login" />

  return (
    <AuthLayout>
      <WorkspaceForm />
    </AuthLayout>
  )
}
