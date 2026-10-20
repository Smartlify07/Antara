import { useMutation } from "@tanstack/react-query"
import { CircleXIcon, Loader2Icon } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { declineRequestFn } from "@/server/functions/requests"
import { useTriageSettled } from "@/components/requests/use-triage-settled"

/**
 * The decline path of the triage toolbar (FR-011). The requester sees the
 * reason on the thread; the decision is final.
 */
export function DeclineDialog({
  workspaceId,
  requestId,
}: {
  workspaceId: string
  requestId: string
}) {
  const settled = useTriageSettled()
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)

  const decline = useMutation({
    mutationFn: async () =>
      declineRequestFn({
        data: {
          workspaceId,
          requestId,
          note: note.trim() || undefined,
        },
      }),
    onSuccess: async () => {
      setOpen(false)
      await settled()
    },
    onError: (mutationError) => {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Could not decline the request."
      )
    },
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="text-destructive hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <CircleXIcon />
        Decline
      </Button>
      <DialogContent className="sm:max-w-3xl lg:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Decline request</DialogTitle>
          <DialogDescription>
            The requester sees this on the thread. Be clear; this decision is
            final.
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="decline-note">
            Reason <span className="text-muted-foreground">(optional)</span>
          </FieldLabel>
          <div className="border-b" />
          <Textarea
            id="decline-note"
            placeholder="Why the workspace won't do this work."
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="min-h-[200px] w-full resize-none border-0 bg-transparent text-sm shadow-none focus-visible:ring-0"
          />
        </Field>
        {error && (
          <div
            role="alert"
            className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => decline.mutate()}
            disabled={decline.isPending}
          >
            {decline.isPending && <Loader2Icon className="animate-spin" />}
            Decline
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
