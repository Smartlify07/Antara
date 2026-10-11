import { useState } from "react"
import { Loader2, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group"

/**
 * Collects the email addresses to send project invites to.
 *
 * Enter or comma commits the current token to a chip; Backspace on an empty
 * input removes the last one. Chips render as text, so an address is never
 * interpreted as markup.
 *
 * The actual send is wired in phase 3 — `project_invites` and its accept route
 * do not exist yet. This builds and validates the form now so the entry point
 * inside the members pill is real, and surfaces a clear state rather than a
 * button that silently does nothing.
 */
export function InviteMemberDialog({
  open,
  onOpenChange,
  workspaceId: _workspaceId,
  projectId: _projectId,
  projectTitle,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
  projectId: string
  projectTitle: string
}) {
  const [emails, setEmails] = useState<string[]>([])
  const [token, setToken] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  function commit(raw: string) {
    const value = raw.trim().replace(/,$/, "").toLowerCase()
    if (!value) return

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError(`"${value}" is not a valid email address.`)
      return
    }
    if (emails.includes(value)) {
      setError(`${value} is already on the list.`)
      return
    }

    setEmails((current) => [...current, value])
    setToken("")
    setError(null)
  }

  function handleSubmit() {
    if (token.trim()) commit(token)
    if (emails.length === 0 && !token.trim()) {
      setError("Add at least one email address.")
      return
    }

    // Phase 3 replaces this. Until `sendProjectInvitesFn` exists there is no
    // server round trip, so the dialog says so rather than closing as though
    // the invites went out.
    setPending(true)
    window.setTimeout(() => {
      setPending(false)
      setError("Invites are not sent yet — this ships in the next commit.")
    }, 400)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setEmails([])
          setToken("")
          setError(null)
        }
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite to {projectTitle}</DialogTitle>
          <DialogDescription>
            They will get access to this project only.
          </DialogDescription>
        </DialogHeader>

        <Field className="gap-2">
          <FieldLabel htmlFor="invite-emails">Email addresses</FieldLabel>
          <InputGroup>
            {emails.map((email) => (
              <InputGroupText key={email}>
                {email}
                <button
                  type="button"
                  aria-label={`Remove ${email}`}
                  onClick={() =>
                    setEmails((current) =>
                      current.filter((entry) => entry !== email)
                    )
                  }
                  className="rounded-full opacity-60 transition-opacity hover:opacity-100"
                >
                  <XIcon className="size-3" />
                </button>
              </InputGroupText>
            ))}
            <InputGroupInput
              id="invite-emails"
              value={token}
              placeholder={
                emails.length > 0 ? "Add another…" : "name@studio.com"
              }
              onChange={(e) => setToken(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault()
                  commit(token)
                }
                if (
                  e.key === "Backspace" &&
                  token === "" &&
                  emails.length > 0
                ) {
                  setEmails((current) => current.slice(0, -1))
                }
              }}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                type="button"
                variant="ghost"
                size="xs"
                disabled={!token.trim()}
                onClick={() => commit(token)}
              >
                Add
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          <FieldDescription>
            Press Enter or comma after each address.
          </FieldDescription>
          {error && <FieldError>{error}</FieldError>}
        </Field>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={pending || emails.length === 0}
          >
            {pending && <Loader2 className="animate-spin" />}
            Send invite{emails.length === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
