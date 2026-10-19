import { useState } from "react"
import {
  CalendarDaysIcon,
  FlagIcon,
  LinkIcon,
  PlusIcon,
  TagIcon,
} from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Chip, ChipOption, ChipRemove } from "@/components/projects/chip"
import { formatDueDate } from "@/lib/time"
import { requestPrioritySchema } from "@/lib/request-schemas"
import type { TaskPriority } from "@/db/enums"

/**
 * The intake form's pills, in the project-create-form chip style. One file
 * so the four stay siblings: category (creatable, colourless), priority
 * (12px dots), deadline (calendar), reference links (count + inline add).
 */

/** The 12px circular indicators the priority dropdown shows per level. */
export const PRIORITY_DOT_CLASS: Record<TaskPriority, string> = {
  low: "bg-muted-foreground/35",
  medium: "bg-yellow-200",
  high: "bg-orange-500",
  urgent: "bg-red-500",
}

function priorityLabel(priority: TaskPriority): string {
  return priority[0].toUpperCase() + priority.slice(1)
}

/** Local-calendar date string the wire schema expects (yyyy-mm-dd). */
export function toDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function CategoryChip({
  options,
  value,
  onChange,
}: {
  options: string[]
  value: string | null
  onChange: (next: string | null) => void
}) {
  const [query, setQuery] = useState("")

  const needle = query.trim().toLowerCase()
  const matching = options.filter(
    (option) =>
      option !== value && (!needle || option.toLowerCase().includes(needle))
  )
  const canCreate =
    needle.length > 0 &&
    !options.some((option) => option.toLowerCase() === needle)

  function pick(label: string) {
    onChange(label)
    setQuery("")
  }

  return (
    <Chip
      placeholder="Add category"
      icon={<TagIcon className="size-3.5 shrink-0" />}
      label={value ?? undefined}
    >
      {value && (
        <div className="mb-1 flex flex-col gap-0.5 border-b pb-1">
          <div className="flex items-center gap-2 rounded-md px-2 py-1 text-sm">
            <TagIcon className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate">{value}</span>
            <ChipRemove label={value} onClick={() => onChange(null)} />
          </div>
        </div>
      )}

      <Command shouldFilter={false} className="bg-transparent">
        <CommandInput
          placeholder="Search or create category…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>
            {canCreate ? `Create "${query.trim()}"` : "No categories yet."}
          </CommandEmpty>
          <CommandGroup>
            {canCreate && (
              <CommandItem
                value="__create__"
                onSelect={() => pick(query.trim())}
                className="gap-2"
              >
                <TagIcon className="size-3.5 shrink-0 text-muted-foreground" />
                <PlusIcon className="size-3.5 shrink-0" />
                <span className="truncate">
                  Create <span className="font-medium">{query.trim()}</span>
                </span>
              </CommandItem>
            )}
            {matching.map((option) => (
              <CommandItem
                key={option}
                value={option}
                onSelect={() => pick(option)}
                className="gap-2"
              >
                <TagIcon className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{option}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </Chip>
  )
}

export function PriorityChip({
  value,
  onChange,
}: {
  value: TaskPriority | null
  onChange: (next: TaskPriority | null) => void
}) {
  return (
    <Chip
      placeholder="Set priority"
      icon={<FlagIcon className="size-3.5 shrink-0" />}
      label={value ? priorityLabel(value) : undefined}
    >
      <div className="flex flex-col gap-0.5">
        {requestPrioritySchema.options.map((priority) => {
          const selected = priority === value

          return (
            <ChipOption
              key={priority}
              selected={selected}
              onSelect={() => onChange(selected ? null : priority)}
              title={priorityLabel(priority)}
            >
              <span
                aria-hidden
                className={`inline-block size-3 shrink-0 rounded-full ${PRIORITY_DOT_CLASS[priority]}`}
              />
            </ChipOption>
          )
        })}
      </div>
    </Chip>
  )
}

export function DeadlineChip({
  deadline,
  onChange,
}: {
  deadline: Date | null
  onChange: (next: Date | null) => void
}) {
  return (
    <Chip
      placeholder="Add deadline"
      icon={<CalendarDaysIcon className="size-3.5 shrink-0" />}
      label={deadline ? `Wanted by ${formatDueDate(deadline)}` : undefined}
    >
      <div className="p-1">
        <Calendar
          mode="single"
          selected={deadline ?? undefined}
          onSelect={(date) => onChange(date ?? null)}
          defaultMonth={deadline ?? undefined}
          className="rounded-md"
        />
        <div className="flex items-center justify-between gap-2 px-1 pt-1 text-[11px] text-muted-foreground">
          <span>{deadline ? "Click a date to change" : "Pick a date"}</span>
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

export function ReferenceLinksChip({
  links,
  onChange,
}: {
  links: string[]
  onChange: (next: string[]) => void
}) {
  const [draft, setDraft] = useState("")
  const [error, setError] = useState<string | null>(null)

  function add() {
    const link = draft.trim()
    if (link.length === 0) return
    if (links.length >= 10) {
      setError("Ten links is plenty for a brief.")
      return
    }
    if (
      links.some((attached) => attached.toLowerCase() === link.toLowerCase())
    ) {
      setError("That link is already attached.")
      return
    }
    onChange([...links, link])
    setDraft("")
    setError(null)
  }

  function remove(link: string) {
    onChange(links.filter((attached) => attached !== link))
    setError(null)
  }

  return (
    <Chip
      placeholder="Add reference links"
      icon={<LinkIcon className="size-3.5 shrink-0" />}
      label={
        links.length === 1
          ? "1 link"
          : links.length > 1
            ? `${links.length} links`
            : undefined
      }
    >
      {(links.length > 0 || error) && (
        <div className="mb-1 flex flex-col gap-0.5 border-b pb-1">
          {error && (
            <p role="alert" className="px-2 py-0.5 text-xs text-destructive">
              {error}
            </p>
          )}
          {links.map((link) => (
            <div
              key={link}
              className="flex items-center gap-2 rounded-md px-2 py-1 text-sm"
            >
              <LinkIcon className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate">{link}</span>
              <ChipRemove label="this link" onClick={() => remove(link)} />
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1 p-1">
        <Input
          aria-label="New reference link"
          placeholder="https://…"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value)
            setError(null)
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              add()
            }
          }}
          className="h-8 flex-1"
        />
        <Button
          type="button"
          size="sm"
          onClick={add}
          disabled={draft.trim().length === 0}
        >
          Add link
        </Button>
      </div>
    </Chip>
  )
}
