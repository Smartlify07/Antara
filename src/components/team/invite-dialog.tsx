import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Loader2, Mail, Shield, User } from "lucide-react"
import { useState } from "react"
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
import { createInviteFn } from "@/server/functions/invites"
import { inviteKeys } from "@/lib/queries/invites"
import { teamKeys } from "@/lib/queries/teams"
import { cn } from "@/lib/utils"

/**
 * Role picker.
 *
 * Both are workspace-scope. The server re-validates the scope rather than
 * trusting this — `roles` holds two scopes sharing the same titles, so a
 * project-scope id here would otherwise sail through the foreign key and
 * break `team` lookups later.
 */
const ROLES = [
  { id: "admin", title: "Admin", icon: Shield, blurb: "Manage people and projects" },
  { id: "member", title: "Member", icon: User, blurb: "Work on projects" },
] as const

interface InviteDialogProps {
  workspaceSlug: string
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
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<"admin" | "member">("member")
  const [error, setError] = useState<string | null>(null)

  const create = useMutation({
    mutationFn: (variables: {
    workspaceSlug: string
    email: string
    roleTitle: "admin" | "member"
  }) => createInviteFn({ data: variables }),
    onSuccess: (result) => {
      if (result.ok) {
        setOpen(false)
        setEmail("")
        setError(null)
        void client.invalidateQueries({
          queryKey: inviteKeys.pending(workspaceSlug),
        })
        void client.invalidateQueries({
          queryKey: teamKeys.members(workspaceId),
        })
        return
      }
      // The server distinguishes "already in this workspace" from a bad role,
      // but never whether the address has an account elsewhere — that answer
      // is global and would be an enumeration oracle for any admin. Its message
      // carries the specific reason, so the code isn't needed here.
      setError(result.message ?? "Could not send that invite.")
    },
    onError: (e) =>
      setError(e instanceof Error ? e.message : "Could not send that invite."),
  })

  const selected = ROLES.find((r) => r.id === role) ?? ROLES[1]

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = email.trim()
    if (!trimmed || create.isPending) return
    setError(null)
    create.mutate({
      workspaceSlug,
      email: trimmed,
      roleTitle: selected.id,
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="shrink-0">
          <Mail />
          Invite member
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite to this workspace</DialogTitle>
          <DialogDescription>
            They&apos;ll get an email with a link. It works whether or not they
            already have an Antara account.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="ada@studio.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={create.isPending}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Role</Label>
            <div className="grid grid-cols-2 gap-2">
              {ROLES.map((r) => {
                const Icon = r.icon
                const active = role === r.id
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRole(r.id)}
                    aria-pressed={active}
                    className={cn(
                      "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors",
                      active
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted",
                    )}
                  >
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      <Icon className="size-4" />
                      {r.title}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {r.blurb}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={create.isPending || email.trim().length === 0}
            >
              {create.isPending && <Loader2 className="animate-spin" />}
              {create.isPending ? "Sending…" : "Send invite"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}