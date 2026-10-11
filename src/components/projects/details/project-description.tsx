import { useEffect, useRef, useState } from "react"
import { Textarea } from "@/components/ui/textarea"

/**
 * The project description, at the bottom of the Overview tab.
 *
 * Borderless on purpose — the create form gives the description a bordered
 * card and a rule above it because it is the main thing being composed. Here
 * it is a reference field that happens to be editable, so it reads as prose and
 * only grows a border while it has focus.
 *
 * Saves on blur rather than per keystroke: this is a textarea up to 2000
 * characters, and a request per character would be absurd.
 */
export function ProjectDescription({
  description,
  canEdit,
  onSave,
  saving,
}: {
  description: string | null
  canEdit: boolean
  onSave: (body: string) => void
  saving: boolean
}) {
  const [draft, setDraft] = useState(description ?? "")
  const [focused, setFocused] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)

  // Adopt server changes while idle — an invalidation after a tag edit, say —
  // but never while the user is mid-sentence, which would move the caret.
  useEffect(() => {
    if (!focused) setDraft(description ?? "")
  }, [description, focused])

  function grow() {
    const el = ref.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }

  useEffect(grow, [draft])

  function handleBlur() {
    setFocused(false)
    const next = draft.trim()
    if (next === (description ?? "").trim()) return
    onSave(next)
  }

  if (!canEdit) {
    return description ? (
      <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
        {description}
      </p>
    ) : (
      <p className="text-sm text-muted-foreground">No description yet.</p>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <Textarea
        ref={ref}
        value={draft}
        maxLength={2000}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={handleBlur}
        placeholder="Add a description…"
        aria-label="Project description"
        className="min-h-[88px] resize-none rounded-none border-0 border-t border-border/60 bg-transparent p-0 pt-4 text-sm leading-relaxed shadow-none focus-visible:ring-0"
      />
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {saving ? "Saving…" : ""}
      </p>
    </div>
  )
}
