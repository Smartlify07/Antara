import { useState } from "react"
import { CalendarDaysIcon } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { Chip } from "@/components/projects/chip"
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
      ? `${format(startDate)} – ${format(deadline)}`
      : startDate
        ? `${format(startDate)} – …`
        : deadline
          ? `Due ${format(deadline)}`
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

function format(date: Date) {
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })
}
