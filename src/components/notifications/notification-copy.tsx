import { cn } from "@/lib/utils"
import type { NotificationCopyPart } from "@/server/services/notification-service"

/**
 * The unread marker, shared by the sidebar badge and each inbox row. It is a
 * plain dot: colour is the only thing that changes between the two places.
 */
export function UnreadOrb({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("size-2 shrink-0 rounded-full bg-primary", className)}
    />
  )
}

/**
 * The row copy, with the actor's name given weight so names read at a glance.
 * An unread row's whole line is already medium, so the name steps up to
 * semibold there; a read row's name is medium over plain text.
 */
export function NotificationMessage({
  parts,
  focus,
}: {
  parts: NotificationCopyPart[]
  focus: boolean
}) {
  return (
    <>
      {parts.map((part, index) =>
        part.actor ? (
          <span key={index} className={focus ? "font-semibold" : "font-medium"}>
            {part.text}
          </span>
        ) : (
          <span key={index}>{part.text}</span>
        )
      )}
    </>
  )
}
