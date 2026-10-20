import { AnimatePresence, motion } from "framer-motion"
import { CircleHelpIcon, Loader2Icon } from "lucide-react"
import { useMutation } from "@tanstack/react-query"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { AcceptDialog } from "@/components/requests/accept-request-dialog"
import { DeclineDialog } from "@/components/requests/decline-request-dialog"
import { requestNeedsInfoFn } from "@/server/functions/requests"
import { useTriageSettled } from "@/components/requests/use-triage-settled"
import type { RequestTriageStatus } from "@/db/enums"

/**
 * The triage toolbar (FR-008, FR-010, FR-011): accept into a project, ask
 * for more information, or decline. Rendered only for admins/leads and only
 * while the request is still alive — terminal requests keep their decision.
 * The accept and decline modals live in their own files; the ask expands
 * inline here because nesting a dialog on a dialog reads badly.
 */
export function RequestTriageBar({
  workspaceId,
  requestId,
  triageStatus,
  canTriage,
}: {
  workspaceId: string
  requestId: string
  triageStatus: RequestTriageStatus
  canTriage: boolean
}) {
  const [askingInfo, setAskingInfo] = useState(false)

  if (
    !canTriage ||
    triageStatus === "accepted" ||
    triageStatus === "declined"
  ) {
    return null
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-muted/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <AcceptDialog workspaceId={workspaceId} requestId={requestId} />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          aria-expanded={askingInfo}
          aria-controls="needs-info-panel"
          onClick={() => setAskingInfo((open) => !open)}
        >
          <CircleHelpIcon />
          Ask for info
        </Button>
        <DeclineDialog workspaceId={workspaceId} requestId={requestId} />
      </div>

      {/* The ask expands in place — no nested dialog in a dialog. */}
      {/* Height on the clipper alone: the container grows; the panel's
          content fades in place inside it (see NeedsInfoPanel), so the input
          never looks like it is stretching with the height. */}
      <AnimatePresence initial={false}>
        {askingInfo && (
          <motion.div
            id="needs-info-panel"
            initial={{ height: 0 }}
            animate={{ height: 200 }}
            exit={{ height: 0 }}
            transition={{ duration: 0.3 }}
            className="w-full overflow-hidden"
          >
            <NeedsInfoPanel
              workspaceId={workspaceId}
              requestId={requestId}
              onClose={() => setAskingInfo(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * The ask, inline: expands under the triage actions instead of opening a
 * nested dialog on top of one. The message posts to the brief thread as the
 * ask, the audit record for the needs-info state.
 */
function NeedsInfoPanel({
  workspaceId,
  requestId,
  onClose,
}: {
  workspaceId: string
  requestId: string
  onClose: () => void
}) {
  const settled = useTriageSettled()
  const [message, setMessage] = useState("")
  const [error, setError] = useState<string | null>(null)

  const needsInfo = useMutation({
    mutationFn: async () =>
      requestNeedsInfoFn({
        data: { workspaceId, requestId, message: message.trim() },
      }),
    onSuccess: async () => {
      setMessage("")
      setError(null)
      onClose()
      await settled()
    },
    onError: (mutationError) => {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Could not ask for information."
      )
    },
  })

  function submit() {
    setError(null)
    if (message.trim().length === 0) {
      // Ask with nothing attached fails the FR by definition — the ask IS
      // the message.
      setError("Write what you need to know.")
      return
    }
    needsInfo.mutate()
  }

  return (
    <motion.div
      // Fade choreography inside the height clipper: the content is at its
      // final size from the first frame and materializes as the container
      // opens; the input never adjusts to the container's height.
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.15, delay: 0.1 } }}
      exit={{ opacity: 0, transition: { duration: 0.1 } }}
      className="flex h-[200px] flex-col gap-2 px-1 pb-1"
    >
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          The request stays open while you wait; your question is visible to the
          requester on the thread.
        </p>
      )}

      {/* Send and cancel live inside the input, matching the thread composer. */}
      <div className="relative min-h-0 flex-1">
        <Textarea
          aria-label="Question for the requester"
          rows={4}
          className="field-sizing-fixed h-full resize-none pr-[12rem]"
          placeholder="What's unclear — scope, audience, deadline?"
          autoFocus
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
        <div className="absolute right-2 bottom-2 flex items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2.5 text-xs"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-7 px-2.5 text-xs"
            onClick={submit}
            disabled={needsInfo.isPending}
          >
            {needsInfo.isPending && <Loader2Icon className="animate-spin" />}
            Send question
          </Button>
        </div>
      </div>
    </motion.div>
  )
}
