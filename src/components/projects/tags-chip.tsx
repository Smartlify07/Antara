import { useState } from "react"
import { PlusIcon, TagIcon } from "lucide-react"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Chip, ChipRemove } from "@/components/projects/chip"
import type { ProjectTagOption } from "@/server/services/project-service"
import { tagColorFor } from "@/lib/tag-colors"

export interface SelectedTag {
  id: string | null
  label: string
  color: string
}

/** The dot that carries a tag's colour. */
export function TagDot({
  color,
  className,
}: {
  color: string
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={`inline-block size-2 shrink-0 rounded-full ${className ?? ""}`}
      style={{ backgroundColor: color }}
    />
  )
}

export function TagsChip({
  options,
  selected,
  onChange,
}: {
  options: ProjectTagOption[]
  selected: SelectedTag[]
  onChange: (next: SelectedTag[]) => void
}) {
  const [query, setQuery] = useState("")

  const selectedLabels = new Set(selected.map((tag) => tag.label.toLowerCase()))
  const needle = query.trim().toLowerCase()

  const matching = options.filter(
    (option) =>
      !selectedLabels.has(option.label.toLowerCase()) &&
      (!needle || option.label.toLowerCase().includes(needle))
  )

  const canCreate =
    needle.length > 0 &&
    !options.some((option) => option.label.toLowerCase() === needle)

  function add(id: string | null, label: string, color?: string) {
    if (selectedLabels.has(label.toLowerCase())) return
    onChange([...selected, { id, label, color: color ?? tagColorFor(label) }])
    setQuery("")
  }

  function remove(label: string) {
    onChange(selected.filter((tag) => tag.label !== label))
  }

  return (
    <Chip
      placeholder="Add tags"
      icon={<TagIcon className="size-3.5 shrink-0" />}
      label={
        selected.length > 0
          ? selected.map((tag) => tag.label).join(", ")
          : undefined
      }
    >
      {selected.length > 0 && (
        <div className="mb-1 flex flex-col gap-0.5 border-b pb-1">
          {selected.map((tag) => (
            <div
              key={tag.label}
              className="flex items-center gap-2 rounded-md px-2 py-1 text-sm"
            >
              <TagDot color={tag.color} />
              <span className="flex-1 truncate">{tag.label}</span>
              <ChipRemove label={tag.label} onClick={() => remove(tag.label)} />
            </div>
          ))}
        </div>
      )}

      <Command shouldFilter={false} className="bg-transparent">
        <CommandInput
          placeholder="Search or create tags…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>
            {canCreate ? `Create "${query.trim()}"` : "No tags yet."}
          </CommandEmpty>
          <CommandGroup>
            {canCreate && (
              <CommandItem
                value="__create__"
                onSelect={() => add(null, query.trim())}
                className="gap-2"
              >
                <TagDot color={tagColorFor(query)} />
                <PlusIcon className="size-3.5 shrink-0" />
                <span className="truncate">
                  Create <span className="font-medium">{query.trim()}</span>
                </span>
              </CommandItem>
            )}
            {matching.map((option) => (
              <CommandItem
                key={option.id}
                value={option.id}
                onSelect={() => add(option.id, option.label, option.color)}
                className="gap-2"
              >
                <TagDot color={option.color} />
                <span className="truncate">{option.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </Chip>
  )
}
