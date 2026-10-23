import { useState } from "react"
import { CalendarDaysIcon } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { Chip } from "@/components/projects/chip"
import { formatDueDate, fromIsoDay, toIsoDay } from "@/lib/time"
import { cn } from "@/lib/utils"

export function DatesChip({
  startDate,
  deadline,
  onChange,
}: {
  startDate: Date | null
  deadline: Date | null
  onChange: (next: { startDate: Date | null; deadline: Date | null }) => void
}) {
  const [pendingStart, setPendingStart] = useState<Date | null>(null)

  const label =
    startDate && deadline
      ? `${formatDueDate(startDate)} – ${formatDueDate(deadline)}`
      : startDate
        ? `${formatDueDate(startDate)} – …`
        : deadline
          ? `Due ${formatDueDate(deadline)}`
          : undefined

  function handleSelect(next: Date | undefined) {
    if (!next) {
      setPendingStart(null)
      onChange({ startDate: null, deadline: null })
      return
    }

    // First click sets the start; the second closes the range.
    if (!pendingStart) {
      setPendingStart(next)
      onChange({ startDate: next, deadline: null })
      return
    }

    // Clicking before the pending start swaps them.
    const [from, to] =
      next < pendingStart ? [next, pendingStart] : [pendingStart, next]
    setPendingStart(null)
    onChange({ startDate: from, deadline: to })
  }

  return (
    <Chip
      placeholder="Add dates"
      icon={<CalendarDaysIcon className="size-3.5 shrink-0" />}
      label={label}
    >
      <div className="p-1">
        <Calendar
          mode="single"
          selected={pendingStart ?? deadline ?? startDate ?? undefined}
          onSelect={handleSelect}
          defaultMonth={startDate ?? deadline ?? undefined}
          className={cn("rounded-md")}
        />
        <div className="flex items-center justify-between gap-2 px-1 pt-1 text-[11px] text-muted-foreground">
          <span>
            {pendingStart
              ? "Now pick an end date"
              : startDate || deadline
                ? "Click a date to start over"
                : "Pick a start date"}
          </span>
          {(startDate || deadline) && (
            <button
              type="button"
              onClick={() => {
                setPendingStart(null)
                onChange({ startDate: null, deadline: null })
              }}
              className="underline underline-offset-2 hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </Chip>
  )
}

/**
 * The single-day deadline pill — the DatesChip's one-click cousin. Owners,
 * deadlines and drafts all hold the wire's date-only string, so this chip
 * speaks ISO on both edges and the calendar never shifts a UTC day.
 */
export function DateChip({
  deadline,
  onChange,
  placeholder = "Add deadline",
  formatLabel = (day) => `due ${formatDueDate(fromIsoDay(day))}`,
  className,
}: {
  /** Date-only wire string ("yyyy-mm-dd"), or null when unset. */
  deadline: string | null
  onChange: (deadline: string | null) => void
  /** Empty-pill copy. */
  placeholder?: string
  /** Filled-pill text; overdue surfaces restate it ("Overdue · May 3"). */
  formatLabel?: (day: string) => string
  /** Extra pill styling — the overdue danger tone, for one. */
  className?: string
}) {
  return (
    <Chip
      placeholder={placeholder}
      icon={<CalendarDaysIcon className="size-3.5 shrink-0" />}
      label={deadline ? formatLabel(deadline) : undefined}
      className={className}
    >
      <div className="p-1">
        <Calendar
          mode="single"
          selected={deadline ? fromIsoDay(deadline) : undefined}
          onSelect={(next) => onChange(next ? toIsoDay(next) : null)}
          defaultMonth={deadline ? fromIsoDay(deadline) : undefined}
          className={cn("rounded-md")}
        />
        <div className="flex items-center justify-between gap-2 px-1 pt-1 text-[11px] text-muted-foreground">
          <span>{deadline ? "Pick another day to change" : "Pick a day"}</span>
          {deadline && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="underline underline-offset-2 hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </Chip>
  )
}
