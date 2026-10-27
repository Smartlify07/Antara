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
import { Textarea } from "@/components/ui/textarea"
import { DECISION_META } from "./version-meta"
import type { DecisionKind } from "./version-meta"

/**
 * The decision dialog, shared by every decider surface — the cabinet's lane,
 * the Reviews queue, the library's asset page. Logic identical across all
 * three: an optional note rides the decision, and the confirm button carries
 * the decision's verb.
 */
export function DecideDialog({
  kind,
  busy,
  onClose,
  onConfirm,
}: {
  kind: DecisionKind
  busy: boolean
  onClose: () => void
  onConfirm: (comment: string) => void
}) {
  const [comment, setComment] = useState("")
  const meta = DECISION_META[kind]

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{meta.label}</DialogTitle>
          <DialogDescription>{meta.description}</DialogDescription>
        </DialogHeader>
        <Textarea
          aria-label="Decision note (optional)"
          rows={3}
          placeholder={
            kind === "changes_requested"
              ? "What should change? (optional)"
              : "Add a note with this decision (optional)"
          }
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          maxLength={2000}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy} onClick={() => onConfirm(comment.trim())}>
            {meta.label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
