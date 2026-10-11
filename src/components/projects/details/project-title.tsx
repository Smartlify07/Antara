import { useEffect, useRef, useState } from "react"
import { CheckIcon, Loader2, PencilIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

/**
 * The project title, editable in place.
 *
 * Saves on blur and on Enter, abandons on Escape — the same contract as the
 * description field. Unlike the description this is a single-line input styled
 * to match the `text-2xl` heading it replaces, so the control is only visible
 * on hover or focus and the page still reads as a document rather than a form.
 *
 * The slug is not re-derived on rename; see `setProjectTitle`.
 */
export function ProjectTitle({
  title,
  canEdit,
  saving,
  onSave,
}: {
  title: string
  canEdit: boolean
  saving: boolean
  onSave: (next: string) => void
}) {
  const [draft, setDraft] = useState(title)
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Adopt server changes while idle — after a rename refetch, or the initial
  // load — but never mid-edit, which would move the caret under the user.
  useEffect(() => {
    if (!editing) setDraft(title)
  }, [title, editing])

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  function commit() {
    setEditing(false)
    const next = draft.trim()
    // The server enforces the same bounds; this keeps the obvious cases from
    // firing a request at all.
    if (next.length < 2 || next === title.trim()) return
    onSave(next)
  }

  function cancel() {
    setDraft(title)
    setEditing(false)
  }

  if (!canEdit) {
    return <h1 className="text-2xl font-medium tracking-tighter">{title}</h1>
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <Input
          ref={inputRef}
          value={draft}
          maxLength={120}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              commit()
            }
            if (e.key === "Escape") {
              e.preventDefault()
              cancel()
            }
          }}
          aria-label="Project title"
          className="h-auto border-0 bg-transparent px-0 py-0 text-2xl font-medium tracking-tighter shadow-none focus-visible:ring-0"
        />
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label="Save title"
          onMouseDown={(e) => e.preventDefault()}
          onClick={commit}
        >
          {saving ? <Loader2 className="animate-spin" /> : <CheckIcon />}
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label="Cancel title edit"
          onMouseDown={(e) => e.preventDefault()}
          onClick={cancel}
        >
          <XIcon />
        </Button>
      </div>
    )
  }

  return (
    <div className="group/title flex items-center gap-2">
      <h1 className="text-2xl font-medium tracking-tighter">{title}</h1>
      <button
        type="button"
        aria-label="Edit project title"
        onClick={() => setEditing(true)}
        className="rounded p-1 text-muted-foreground opacity-0 transition-opacity group-hover/title:opacity-100 hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <PencilIcon className="size-4" />
      </button>
    </div>
  )
}
