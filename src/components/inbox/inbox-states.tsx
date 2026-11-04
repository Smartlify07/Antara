import { Skeleton } from "@/components/ui/skeleton"
import { InboxIcon } from "lucide-react"

/** The three states the page can be in before it has rows to show. */
export function InboxLoading() {
  return (
    <div className="divide-y divide-border rounded-xl border bg-card">
      {[0, 1, 2, 3, 4].map((row) => (
        <div key={row} className="flex items-start gap-3 px-4 py-3">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2 py-0.5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function InboxEmpty() {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed px-6 py-12 text-center">
      <InboxIcon aria-hidden className="mb-1 size-5 text-muted-foreground/60" />
      <p className="text-sm font-medium">All caught up</p>
      <p className="text-xs text-muted-foreground">
        Project, task, review and feedback updates will land here.
      </p>
    </div>
  )
}

export function InboxError({ message }: { message?: string }) {
  return (
    <p
      role="alert"
      className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
    >
      {message ?? "Could not load your inbox. Try refreshing the page."}
    </p>
  )
}
