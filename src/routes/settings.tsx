import { Link, createFileRoute, redirect } from "@tanstack/react-router"
import { Logo } from "@/components/logo"
import { NotificationsSettings } from "@/components/settings/notifications-settings"
import { authLandingFn } from "@/server/functions/workspaces"

/**
 * Account settings. The first standalone authenticated page outside the
 * workspace shell — it owns no workspace context, so it brings its own minimal
 * chrome and guards its own session.
 *
 * Push subscriptions are account-scoped (a person's browsers), which is why the
 * notifications toggle lives here rather than under `/w/$workspaceSlug`.
 */
export const Route = createFileRoute("/settings")({
  beforeLoad: async () => {
    const landing = await authLandingFn()
    if (!landing) {
      throw redirect({ to: "/login", search: { callbackURL: "/settings" } })
    }
  },
  component: SettingsPage,
})

function SettingsPage() {
  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-4">
          <Link
            to="/dashboard"
            aria-label="Back to Antara"
            className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Logo className="size-7 text-primary" />
          </Link>
          <span className="text-sm text-muted-foreground">Settings</span>
          <span aria-hidden className="size-7" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Manage your Antara account.
          </p>
        </div>

        <NotificationsSettings />
      </main>
    </div>
  )
}
