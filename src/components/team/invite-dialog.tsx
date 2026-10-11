import { useMutation, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, CheckCircle2, Loader2, Mail } from "lucide-react"
import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createInviteFn, type InviteOutcome } from "@/server/functions/invites"
import { parseEmailList } from "@/lib/parse-email-list"
import { teamKeys } from "@/lib/queries/teams"
import { workspaceKeys } from "@/lib/queries/workspaces"

interface InviteDialogProps {
  workspaceSlug: string
  /** Keys the member query. Distinct from the slug — see the note below. */
  workspaceId: string
}

/**
 * `workspaceSlug` addresses the server functions; `workspaceId` keys the
 * queries. They are different identifiers and the two are easy to swap — doing
 * so produces an invalidation that silently matches nothing.
 */
export function InviteDialog({
  workspaceSlug,
  workspaceId,
}: InviteDialogProps) {
  const client = useQueryClient()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState("")
  const [outcomes, setOutcomes] = useState<InviteOutcome[]>([])

  const { emails, invalid } = useMemo(() => parseEmailList(input), [input])

  const send = useMutation({
    mutationFn: (batch: string[]) =>
      createInviteFn({ data: { workspaceSlug, emails: batch } }),
    onSuccess: ({ outcomes: results }) => {
      // Pending invitees are seats on the member list now, so that's the one
      // query to refresh — there's no separate invites list to keep in step.
      void client.invalidateQueries({
        queryKey: teamKeys.members(workspaceId),
      })

      // The sidebar badge counts the same seats, so it has to move with them.
      // Missed this and the number stays frozen until the badge is next
      // mounted, which looks like the invite didn't land.
      void client.invalidateQueries({
        queryKey: workspaceKeys.teamCount(workspaceSlug),
      })

      setOutcomes(results)

      // Only clear the addresses that worked. Leaving the failures in the box
      // means the admin can fix a typo and resend without re-pasting
      // everything, and it keeps the bad ones visible.
      if (results.every((r) => r.ok)) {
        setInput("")
        setOpen(false)
        setOutcomes([])
        return
      }
      setInput(
        results
          .filter((r) => !r.ok)
          .map((r) => r.email)
          .join(", ")
      )
    },
    onError: (e) =>
      setOutcomes([
        {
          email: "",
          ok: false,
          message: e instanceof Error ? e.message : "Could not send invites.",
        },
      ]),
  })

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!emails.length || send.isPending) return
    setOutcomes([])
    send.mutate(emails)
  }

  const failed = outcomes.filter((o) => !o.ok)
  const sent = outcomes.filter((o) => o.ok)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          setInput("")
          setOutcomes([])
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" className="shrink-0">
          <Mail />
          Invite member
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Invite your team</DialogTitle>
          <DialogDescription>
            Enter the email addresses of your team members, separated by commas.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-emails">Email addresses</Label>
            <Input
              id="invite-emails"
              type="text"
              inputMode="email"
              autoComplete="off"
              placeholder="ada@studio.com, grace@studio.com"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={send.isPending}
            />

            <p className="text-xs text-muted-foreground">
              {emails.length > 0 && (
                <>
                  {emails.length === 1
                    ? "1 recipient"
                    : `${emails.length} recipients`}
                </>
              )}
              {emails.length > 0 && invalid.length > 0 && " · "}
              {invalid.length > 0 && (
                <>
                  {invalid.length === 1
                    ? "1 entry isn't a valid email address"
                    : `${invalid.length} entries aren't valid email addresses`}{" "}
                  and will be skipped
                </>
              )}
            </p>
          </div>

          {sent.length > 0 && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4 text-emerald-600" />
              {sent.length === 1
                ? "1 invite sent"
                : `${sent.length} invites sent`}
              .
            </p>
          )}

          {failed.length > 0 && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm"
            >
              <p className="mb-1 flex items-center gap-2 font-medium text-destructive">
                <AlertTriangle className="size-4 shrink-0" />
                {failed.length === 1
                  ? "1 invite wasn't sent"
                  : `${failed.length} invites weren't sent`}
              </p>
              <ul className="space-y-1 text-destructive">
                {failed.map((o) => (
                  <li key={o.email || "unknown"} className="truncate text-xs">
                    <span className="font-medium">{o.email}</span>
                    {o.message ? ` — ${o.message}` : null}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              {failed.length > 0 ? "Done" : "Cancel"}
            </Button>
            <Button
              type="submit"
              disabled={send.isPending || emails.length === 0}
            >
              {send.isPending && <Loader2 className="animate-spin" />}
              {send.isPending ? "Sending…" : "Send invites"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
