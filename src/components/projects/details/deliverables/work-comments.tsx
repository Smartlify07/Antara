import { SendIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { formatRelativeTime } from "@/lib/time"

/**
 * The borderless comment row + composer shared by the deliverable cabinet's
 * threads (version feedback, the deliverable's own conversation) and the task
 * page's thread. One vocabulary on purpose: identity reads as an initials
 * dot, hierarchy comes from spacing and text tone, and no line ever needs a
 * container — the compose affordance is a quiet text field plus a send button.
 *
 * The mutation stays with the caller (each thread wires its own optimistic
 * post against its own query key); these pieces only render.
 */

/**
 * Every lane's thread message shape — `VersionThreadMessage`,
 * `DeliverableThreadMessage`, `TaskThreadMessage`, and the optimistic rows
 * each lane appends before settle — all satisfy this structurally, so the
 * rows never branch on which thread they belong to.
 */
export interface ThreadMessage {
  id: string
  body: string
  createdAt: Date
  authorId: string | null
  authorName: string | null
  authorEmail: string | null
}

/** One post: initials dot, name · time, then the body. No separators. */
export function ThreadRow({ message }: { message: ThreadMessage }) {
  return (
    <div className="flex gap-3 py-3">
      <span
        aria-hidden
        className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium"
      >
        {initialsOf(message)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {message.authorName ?? "Former member"}
          </span>
          <span aria-hidden> · </span>
          {formatRelativeTime(message.createdAt)}
        </p>
        <p className="mt-0.5 text-sm break-words whitespace-pre-wrap">
          {message.body}
        </p>
      </div>
    </div>
  )
}

/**
 * The compose affordance, controlled: Enter sends, Shift+Enter breaks, the
 * field grows with its text (`field-sizing: content`, pinned by a floor
 * height for older engines), the resize handle is gone, and the send lives
 * inside the field's corner instead of outside it — the composer reads as
 * one quiet surface, not a form row.
 */
export function ThreadComposer({
  value,
  onChange,
  onSubmit,
  pending,
  placeholder,
  label,
}: {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  pending: boolean
  placeholder: string
  /** Accessible name for the field — visible labels would box the thread. */
  label: string
}) {
  const hasText = value.trim().length > 0
  return (
    <form
      className="relative pt-1"
      onSubmit={(event) => {
        event.preventDefault()
        if (hasText) onSubmit()
      }}
    >
      <Textarea
        aria-label={label}
        className="field-sizing-content max-h-48 min-h-12 resize-none pr-12"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault()
            if (hasText) onSubmit()
          }
        }}
      />
      <Button
        type="submit"
        size="icon"
        disabled={!hasText || pending}
        className="absolute right-1.5 bottom-1 size-8 rounded-full"
      >
        <SendIcon />
        <span className="sr-only">Post</span>
      </Button>
    </form>
  )
}

/** The thread's loading voice: a quiet line, never a spinner. */
export function ThreadLoading({ label }: { label: string }) {
  return <p className="py-3 text-sm text-muted-foreground">{label}</p>
}

/** Empty-state voice, per thread. */
export function ThreadEmpty({ children }: { children: string }) {
  return <p className="py-3 text-sm text-muted-foreground">{children}</p>
}

/** Thread-level error voice (a failed load, not a failed post). */
export function ThreadError({ children }: { children: string }) {
  return (
    <p role="alert" className="py-3 text-sm text-destructive">
      {children}
    </p>
  )
}

function initialsOf(message: ThreadMessage): string {
  const source = message.authorName?.trim() || message.authorEmail?.trim() || ""
  const first = source[0]
  // Old threads can outlive their author's account row; the ? keeps the
  // rhythm of the thread without pretending to know a name.
  return first ? first.toUpperCase() : "?"
}
