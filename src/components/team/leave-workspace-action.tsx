"use client"

import { useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { LogOutIcon, MoreHorizontalIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MemberConfirmDialog } from "@/components/team/member-confirm-dialog"
import { useLeaveWorkspace } from "@/lib/queries/teams"

/**
 * The menu on your own row.
 *
 * Leaving is a self-action, not a member-management one: it needs no admin
 * rights, and it is the only action an owner takes on their own seat. That is
 * why it is a separate control from `MemberActions` rather than another item
 * inside it — the two have different permissions and different targets.
 */
export function LeaveWorkspaceAction({
  workspaceSlug,
}: {
  workspaceSlug: string
}) {
  const leave = useLeaveWorkspace(workspaceSlug)
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  async function run() {
    const { landingSlug } = await leave.mutateAsync()
    // The destination is resolved server-side *after* the write, so the client
    // does not have to guess whether another workspace is available.
    if (landingSlug) {
      await navigate({
        to: "/w/$workspaceSlug/projects",
        params: { workspaceSlug: landingSlug },
      })
      return
    }
    await navigate({ to: "/workspaces/new" })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Your membership actions"
          >
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setOpen(true)}
          >
            <LogOutIcon />
            Leave workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <MemberConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Leave this workspace?"
        description="You lose access immediately. The work you created stays, credited to you. If you own the workspace, its ownership goes dormant and the admins keep running it."
        confirmLabel="Leave"
        pendingLabel="Leaving…"
        destructive
        run={run}
      />
    </>
  )
}
