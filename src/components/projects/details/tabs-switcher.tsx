import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import { TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

/**
 * A tab list with a sliding active pill.
 *
 * Radix exposes the selected trigger as `data-active`, but paints it with a
 * static background, so the highlight jumps between tabs instead of moving.
 * Here one absolutely-positioned indicator slides to whichever tab is active.
 *
 * The indicator is placed by index rather than by measuring the DOM: the
 * triggers are equal-width (`basis-1/N`), so the left edge is exactly
 * `index / count` of the track. Measuring would handle variable widths, but
 * needs a layout effect and a resize observer for no gain while the tab count
 * is fixed and the labels are short.
 *
 * The parent `Tabs` is controlled, so this reads the active value from props
 * rather than from `TabsList` — Radix's `List` has no `value` prop.
 */
export function TabsSwitcher({
  value,
  tabs,
  className,
}: {
  value: string
  tabs: { value: string; label: ReactNode }[]
  className?: string
}) {
  const index = Math.max(
    0,
    tabs.findIndex((tab) => tab.value === value)
  )

  // Off for the first paint so the pill appears under the tab that is already
  // selected rather than sliding in from the left on load.
  const [animated, setAnimated] = useState(false)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setAnimated(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  // `TabsList` takes no `value`/`onValueChange` — Radix's List is presentational.
  // The controlling `Tabs` root above owns the selection and a trigger click
  // bubbles up to it, so the switcher only needs `value` to place the indicator.
  return (
    <TabsList
      className={cn(
        "relative h-11 items-stretch gap-0 bg-muted/60 p-1",
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute top-1 bottom-1 left-1 rounded-md bg-background shadow-sm",
          animated && "transition-transform duration-200 ease-out"
        )}
        style={{
          width: `calc((100% - 0.5rem) / ${tabs.length})`,
          transform: `translateX(${index * 100}%)`,
        }}
      />
      {tabs.map((tab) => (
        <TabsTrigger
          key={tab.value}
          value={tab.value}
          // Above the indicator, which is decoration.
          className="z-1 basis-1/2 px-5 text-sm data-active:bg-transparent data-active:shadow-none"
        >
          {tab.label}
        </TabsTrigger>
      ))}
    </TabsList>
  )
}
