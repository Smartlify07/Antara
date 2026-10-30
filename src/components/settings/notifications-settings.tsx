import { BellRingIcon, ShieldAlertIcon } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { usePush } from "@/hooks/use-push"

/**
 * The account-level browser-notifications toggle. A subscription is per
 * browser but belongs to the signed-in user, so it lives here on the settings
 * page rather than inside a workspace.
 *
 * The switch is the whole interface; `usePush` owns the state machine and the
 * service-worker/permission/subscription plumbing, so this component stays a
 * pure rendering of one boolean plus its two failure modes.
 */
export function NotificationsSettings() {
  const push = usePush()

  const loading = push.status === "loading"

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>
          Control when Antara reaches you outside the app.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-start gap-3">
            <BellRingIcon className="mt-0.5 size-5 text-muted-foreground" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Browser push notifications</p>
              <p className="text-sm text-muted-foreground">
                Get a notification when work is assigned to you, sent for
                review, or needs your feedback — even when Antara isn&apos;t
                open.
              </p>
            </div>
          </div>
          <Switch
            checked={push.subscribed}
            disabled={loading || !push.supported}
            onCheckedChange={(on) => void (on ? push.enable() : push.disable())}
            aria-label="Enable browser push notifications"
          />
        </div>

        {push.error && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            <ShieldAlertIcon className="mt-0.5 size-4 shrink-0" />
            {push.error}
          </p>
        )}

        {push.denied && (
          <p
            role="status"
            className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground"
          >
            <ShieldAlertIcon className="mt-0.5 size-4 shrink-0" />
            Notifications are blocked in this browser. Allow them from your
            browser&apos;s site settings to enable this.
          </p>
        )}

        {!push.supported && !push.denied && (
          <p
            role="status"
            className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground"
          >
            <ShieldAlertIcon className="mt-0.5 size-4 shrink-0" />
            Browser notifications aren&apos;t available here — your browser may
            not support them, or this page isn&apos;t running over a secure
            connection.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
