"use client"

import { useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useMemberMutations } from "@/lib/queries/teams"

/**
 * Confirmation for ending someone's access.
 *
 * Not optimistic, and it stays mounted for the round trip: the row behind it is
 * what disappears on success, so closing first would take a refusal's message
 * with it. Same reasoning as the project card's trash confirm.
 */
export function RemoveMemberDialog({
  open,
  onOpenChange,
  membershipId,
  name,
  workspaceSlug,
  workspaceId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  membershipId: string
  name: string
  workspaceSlug: string
  workspaceId: string
}) {
  const { remove } = useMemberMutations(workspaceSlug, workspaceId)
  const [error, setError] = useState<string | null>(null)

  function confirm() {
    setError(null)
    remove.mutate(membershipId, {
      onSuccess: () => onOpenChange(false),
      onError: (cause) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not remove this member."
        ),
    })
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setError(null)
        onOpenChange(next)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            They lose access to this workspace immediately. Their projects,
            tasks, and versions stay, credited to them.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={remove.isPending}
            onClick={(event) => {
              event.preventDefault()
              confirm()
            }}
          >
            {remove.isPending ? "Removing…" : "Remove"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
