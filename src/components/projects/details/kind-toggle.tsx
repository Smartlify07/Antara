import { MessageSquareIcon, TrendingUpIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { UpdateKind } from "@/db/enums"

/**
 * Picks what kind of post is being written.
 *
 * A segmented pair rather than a select: two options, both one tap, and the
 * choice is a live decision about the post in front of you rather than a
 * setting. Comments come first and are the default because they are the common
 * case — a post sent without thinking about this stays the quieter option.
 *
 * Shared by the composer and nothing else; the feed renders the kind as a label
 * on the card rather than offering the control.
 */
const KIND_OPTIONS = [
  { value: "comment" as const, label: "Comment", icon: MessageSquareIcon },
  {
    value: "progress_update" as const,
    label: "Progress update",
    icon: TrendingUpIcon,
  },
]

export function KindToggle({
  kind,
  onChange,
  disabled,
}: {
  kind: UpdateKind
  onChange: (next: UpdateKind) => void
  disabled?: boolean
}) {
  return (
    <div
      role="group"
      aria-label="Post type"
      className="flex w-fit items-center gap-0.5 rounded-lg bg-muted/60 p-0.5"
    >
      {KIND_OPTIONS.map((option) => {
        const active = option.value === kind
        const Icon = option.icon
        return (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              "disabled:pointer-events-none disabled:opacity-50",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="size-3.5" />
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export const UPDATE_KIND_LABEL: Record<UpdateKind, string> = {
  comment: "Comment",
  progress_update: "Progress update",
}
