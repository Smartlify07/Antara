import { CircleDashedIcon } from "lucide-react"
import type { ProjectStatus } from "@/db/enums"
import { Chip, ChipOption } from "@/components/projects/chip"
import { PROJECT_STATUS_META, PROJECT_STATUS_ORDER } from "@/lib/status-meta"

export function StatusChip({
  status,
  onChange,
}: {
  status: ProjectStatus
  onChange: (next: ProjectStatus) => void
}) {
  const current = PROJECT_STATUS_META[status]
  const CurrentIcon = current?.icon ?? CircleDashedIcon

  return (
    <Chip
      placeholder="Set status"
      icon={
        <CurrentIcon
          className={`size-3.5 shrink-0 ${current?.textClass ?? ""}`}
        />
      }
      label={current?.label}
    >
      <div className="flex flex-col gap-0.5">
        {PROJECT_STATUS_ORDER.map((value) => {
          const option = PROJECT_STATUS_META[value]
          const OptionIcon = option.icon
          const selected = value === status

          return (
            <ChipOption
              key={value}
              selected={selected}
              onSelect={() => onChange(value)}
              title={option.label}
            >
              <span
                className={`flex size-5 shrink-0 items-center justify-center rounded-full ${option.badgeClass}`}
              >
                <OptionIcon className="size-3" />
              </span>
            </ChipOption>
          )
        })}
      </div>
    </Chip>
  )
}
