import type { ReactNode } from "react"
import { X } from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export function Chip({
  icon,
  label,
  placeholder,
  className,
  children,
}: {
  icon?: ReactNode
  /** Rendered when nothing is selected. */
  placeholder: string
  /** Rendered when one or more values are selected. */
  label?: ReactNode
  className?: string
  children: ReactNode
}) {
  const filled = label !== undefined && label !== null && label !== ""

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex max-w-56 items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground ring-1 ring-border transition-colors",
            !filled && "text-muted-foreground",
            className
          )}
        >
          {icon}
          <span className="truncate">
            {filled ? label : <span>{placeholder}</span>}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-1">
        {children}
      </PopoverContent>
    </Popover>
  )
}

export function ChipRemove({
  onClick,
  label,
}: {
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Remove ${label}`}
      className="-mr-1 ml-auto shrink-0 rounded-full p-0.5 opacity-70 transition-colors hover:bg-muted hover:opacity-100"
    >
      <X className="size-3" />
    </button>
  )
}

export function ChipOption({
  selected,
  onSelect,
  title,
  subtitle,
  disabled,
  children,
}: {
  selected: boolean
  onSelect: () => void
  title: string
  subtitle?: string | null
  disabled?: boolean
  /** Optional leading element, e.g. a status icon. */
  children?: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      title={title}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50",
        selected && "bg-accent/60"
      )}
    >
      {children}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate">{title}</span>
        {subtitle && (
          <span className="truncate text-xs text-muted-foreground">
            {subtitle}
          </span>
        )}
      </span>
      {selected && <span className="text-xs">✓</span>}
    </button>
  )
}
