import { Navigate, createFileRoute } from "@tanstack/react-router"
import { AuthLayout } from "@/components/auth/auth-layout"
import { AuthPending } from "@/components/auth/auth-pending"
import { WorkspaceForm } from "@/components/workspaces/workspace-form"
import { useAuthStatus } from "@/lib/use-auth-status"

export const Route = createFileRoute("/workspaces/new")({
  component: NewWorkspacePage,
})

function NewWorkspacePage() {
  // Latched status, not `useSession().isPending` — the raw flag swaps this
  // subtree for a spinner on any background refetch, which unmounts the form
  // and blanks it. See `useAuthStatus`.
  const status = useAuthStatus()

  return (
    <AuthLayout>
      {status === "pending" ? (
        <AuthPending />
      ) : status === "anonymous" ? (
        <Navigate to="/login" />
      ) : (
        <WorkspaceForm />
      )}
    </AuthLayout>
  )
}
