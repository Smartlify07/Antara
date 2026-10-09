import { createFileRoute, redirect } from "@tanstack/react-router"
import { AuthLayout } from "@/components/auth/auth-layout"
import { WorkspaceForm } from "@/components/workspaces/workspace-form"
import { authLandingFn } from "@/server/functions/workspaces"

export const Route = createFileRoute("/workspaces/new")({
  // Anonymous visitors are turned away before the form renders. Previously
  // this rendered `null` while the session resolved, which blanked the page,
  // and swapped to a spinner on any background refetch.
  beforeLoad: async () => {
    const landing = await authLandingFn()
    if (!landing) throw redirect({ to: "/login" })
  },
  component: NewWorkspacePage,
})

function NewWorkspacePage() {
  return (
    <AuthLayout>
      <WorkspaceForm />
    </AuthLayout>
  )
}
