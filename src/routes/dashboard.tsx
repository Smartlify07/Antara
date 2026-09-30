import { Navigate, createFileRoute, useNavigate } from "@tanstack/react-router"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { authClient, useSession } from "@/lib/auth-client"

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
})

function DashboardPage() {
  const { data, isPending } = useSession()
  const navigate = useNavigate()

  if (isPending) {
    return (
      <main className="flex min-h-svh items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground" />
      </main>
    )
  }

  if (!data?.session) return <Navigate to="/login" />

  const { user } = data
  const initials = user.name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  async function handleSignOut() {
    await authClient.signOut()
    await navigate({ to: "/login" })
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <span
            aria-hidden
            className="flex size-12 items-center justify-center rounded-full bg-primary text-base font-semibold text-primary-foreground"
          >
            {initials}
          </span>
          <CardTitle>{user.name}</CardTitle>
          <CardDescription>{user.email}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <p className="text-sm text-muted-foreground">
            {user.emailVerified ? "Email verified." : "Email not verified yet."}{" "}
            Workspaces live here soon.
          </p>
          <Button variant="outline" onClick={handleSignOut}>
            Sign out
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
