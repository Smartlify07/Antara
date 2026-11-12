import { cn } from "@/lib/utils"

/**
 * The one pill shape on the team roster. Awaiting, suspended, role and owner
 * are the same visual unit in four tones — rendered from one component so they
 * cannot drift apart the way four inline `<span>`s would.
 */

const TONES = {
  owner: "bg-primary text-primary-foreground",
  role: "bg-secondary text-secondary-foreground",
  muted: "bg-muted text-muted-foreground",
  pending:
    "bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
} as const

export type MemberPillTone = keyof typeof TONES

export function MemberPill({
  tone = "role",
  children,
}: {
  tone?: MemberPillTone
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium",
        TONES[tone]
      )}
    >
      {children}
    </span>
  )
}
