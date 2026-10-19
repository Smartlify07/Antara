import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AnimatePresence, motion } from "framer-motion"
import {
  CircleCheckIcon,
  CircleHelpIcon,
  CircleXIcon,
  Loader2Icon,
} from "lucide-react"
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
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  acceptRequestFn,
  declineRequestFn,
  requestNeedsInfoFn,
} from "@/server/functions/requests"
import { projectsQuery } from "@/lib/queries/projects"
import { requestKeys } from "@/lib/queries/requests"
import type { RequestTriageStatus } from "@/db/enums"

/**
 * The triage toolbar (FR-008, FR-010, FR-011): accept into a project, ask
 * for more information, or decline. Rendered only for admins/leads and only
 * while the request is still alive — terminal requests keep their decision.
 *
 * The message each action posts is the audit trail (triage writes stamp the
 * decision onto the brief thread server-side), so each dialog carries an
 * optional note that becomes that message.
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

function useTriageSettled() {
  const queryClient = useQueryClient()
  return async () => {
    await queryClient.invalidateQueries({ queryKey: requestKeys.all })
  }
}

function AcceptDialog({
  workspaceId,
  requestId,
}: {
  workspaceId: string
  requestId: string
}) {
  const settled = useTriageSettled()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<"new" | "existing">("new")
  const [projectId, setProjectId] = useState("")
  const [projectTitle, setProjectTitle] = useState("")
  const [projectDescription, setProjectDescription] = useState("")
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)

  const { data: projects = [] } = useQuery({
    ...projectsQuery(workspaceId),
    enabled: open,
  })

  const accept = useMutation({
    mutationFn: async () => {
      const destination =
        mode === "existing"
          ? { projectId }
          : {
              newProjectTitle: projectTitle.trim(),
              newProjectDescription: projectDescription.trim() || undefined,
            }
      return acceptRequestFn({
        data: {
          workspaceId,
          requestId,
          ...destination,
          note: note.trim() || undefined,
        },
      })
    },
    onSuccess: async () => {
      setOpen(false)
      await settled()
    },
    onError: (mutationError) => {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Could not accept the request."
      )
    },
  })

  function submit() {
    setError(null)
    if (mode === "existing" && !projectId) {
      setError("Pick the project this request becomes work in.")
      return
    }
    if (mode === "new" && projectTitle.trim().length === 0) {
      setError("Name the project the work lands in.")
      return
    }
    accept.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        size="sm"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <CircleCheckIcon />
        Accept
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Accept into a project</DialogTitle>
          <DialogDescription>
            The request becomes work in a project. This decision is final.
          </DialogDescription>
        </DialogHeader>

        {/* Padded div instead of a form onSubmit — the footer button below is
            the only submit affordance and completing the action from here is
            intentionally an explicit click, not an accidental Enter. */}
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2" role="tablist">
            {(["new", "existing"] as const).map((candidate) => (
              <Button
                key={candidate}
                type="button"
                variant={mode === candidate ? "default" : "secondary"}
                size="sm"
                role="tab"
                aria-selected={mode === candidate}
                onClick={() => setMode(candidate)}
              >
                {candidate === "new" ? "New project" : "Existing project"}
              </Button>
            ))}
          </div>

          {mode === "new" ? (
            <>
              <Field>
                <FieldLabel htmlFor="accept-project-title">
                  Project name
                </FieldLabel>
                <Input
                  id="accept-project-title"
                  value={projectTitle}
                  onChange={(event) => setProjectTitle(event.target.value)}
                  placeholder="Spring teaser campaign"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="accept-project-description">
                  Description{" "}
                  <span className="text-muted-foreground">(optional)</span>
                </FieldLabel>
                <Input
                  id="accept-project-description"
                  value={projectDescription}
                  onChange={(event) =>
                    setProjectDescription(event.target.value)
                  }
                />
              </Field>
            </>
          ) : (
            <Field>
              <FieldLabel htmlFor="accept-project-select">Project</FieldLabel>
              <select
                id="accept-project-select"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none"
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
              >
                <option value="">Choose a project…</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </select>
              {projects.length === 0 && (
                <FieldDescription>
                  No projects in this workspace yet — create one as “new”
                  instead.
                </FieldDescription>
              )}
            </Field>
          )}

          <Field>
            <FieldLabel htmlFor="accept-note">
              Note <span className="text-muted-foreground">(optional)</span>
            </FieldLabel>
            <Textarea
              id="accept-note"
              rows={2}
              placeholder="Posted on the request thread as the decision record."
              value={note}
              onChange={(event) => setNote(event.target.value)}
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
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={accept.isPending}>
            {accept.isPending && <Loader2Icon className="animate-spin" />}
            Accept
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
      className="flex h-[200px] flex-col gap-2"
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

function DeclineDialog({
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Decline request</DialogTitle>
          <DialogDescription>
            The requester sees this on the thread. Be clear; this decision is
            final.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Field>
            <FieldLabel htmlFor="decline-note">
              Reason <span className="text-muted-foreground">(optional)</span>
            </FieldLabel>
            <Textarea
              id="decline-note"
              rows={3}
              placeholder="Why the workspace won't do this work."
              value={note}
              onChange={(event) => setNote(event.target.value)}
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
        </div>
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
