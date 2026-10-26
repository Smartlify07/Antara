import { Logo } from "@/components/logo"
import {
  CalendarClock,
  FolderOpen,
  Image,
  Inbox,
  ListTodo,
  MessageSquare,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Static mock of the Antara app chrome for the landing-page hero: the same
 * sidebar sections the real workspace layout has (Projects, Requests,
 * Library, Reviews, Team), with sample project and task rows.
 */
const navItems = [
  { icon: FolderOpen, label: "Projects", active: true },
  { icon: Inbox, label: "Requests", badge: 4 },
  { icon: Image, label: "Library" },
  { icon: MessageSquare, label: "Reviews" },
  { icon: ListTodo, label: "My Tasks", badge: 7 },
  { icon: Users, label: "Team" },
]

const projects = [
  {
    name: "Autumn campaign video",
    client: "Northwind Retail",
    progress: 72,
    tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    tag: "On track",
  },
  {
    name: "Product photography refresh",
    client: "Vela Cosmetics",
    progress: 38,
    tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    tag: "In review",
  },
  {
    name: "Podcast brand kit",
    client: "Cutroom Media",
    progress: 15,
    tone: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
    tag: "Planning",
  },
]

const activity = [
  {
    icon: ShieldCheck,
    title: "Final cut v4 approved",
    meta: "Autumn campaign · by Maya",
    accent: "text-emerald-500",
  },
  {
    icon: MessageSquare,
    title: "2 new comments on v3",
    meta: "Product photography · Lucas",
    accent: "text-sky-500",
  },
  {
    icon: CalendarClock,
    title: "Deadline moved to Fri",
    meta: "Podcast brand kit · Sam",
    accent: "text-amber-500",
  },
]

export function HeroAppPreview({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative flex aspect-15/8 overflow-hidden rounded-2xl bg-background text-left",
        className
      )}
    >
      {/* Sidebar */}
      <div className="hidden w-44 shrink-0 flex-col border-r bg-sidebar p-3 md:flex">
        <div className="flex items-center gap-2 px-1 pb-4">
          <Logo className="size-5 text-sidebar-foreground" />
          <span className="text-sm font-semibold text-sidebar-foreground">
            Antara
          </span>
        </div>

        <div className="mb-4 flex items-center gap-2 rounded-md bg-sidebar-accent px-2 py-1.5 text-xs text-sidebar-foreground">
          <Search className="size-3.5 opacity-50" />
          <span className="opacity-60">Search…</span>
        </div>

        <nav className="space-y-0.5">
          {navItems.map((item) => (
            <div
              key={item.label}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium",
                item.active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/60"
              )}
            >
              <item.icon className="size-3.5" />
              <span>{item.label}</span>
              {item.badge ? (
                <span className="ml-auto rounded-full bg-sidebar-primary/10 px-1.5 py-px text-[10px] font-semibold text-sidebar-primary">
                  {item.badge}
                </span>
              ) : null}
            </div>
          ))}
        </nav>
      </div>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col p-4 md:p-5">
        <div className="flex items-center justify-between pb-3">
          <div>
            <div className="text-sm font-semibold text-foreground">
              Projects
            </div>
            <div className="text-[11px] text-muted-foreground">
              Spring studio · 3 active
            </div>
          </div>
          <div className="rounded-md bg-primary px-2.5 py-1.5 text-[11px] font-medium text-primary-foreground">
            New project
          </div>
        </div>

        <div className="grid min-h-0 grid-cols-1 gap-2.5 sm:grid-cols-3">
          {projects.map((project) => (
            <div
              key={project.name}
              className="flex flex-col gap-2 rounded-lg bg-card p-3 ring ring-foreground/10"
            >
              <div className="aspect-video w-full rounded-md bg-muted" />
              <div className="truncate text-xs font-medium text-foreground">
                {project.name}
              </div>
              <div className="truncate text-[10px] text-muted-foreground">
                {project.client}
              </div>
              <div className="mt-auto flex items-center justify-between pt-1">
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[9px] font-semibold",
                    project.tone
                  )}
                >
                  {project.tag}
                </span>
                <span className="text-[10px] font-medium text-muted-foreground">
                  {project.progress}%
                </span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${project.progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-2.5 min-h-0 flex-1 rounded-lg bg-card p-3 ring ring-foreground/10">
          <div className="pb-2 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            Activity
          </div>
          <div className="space-y-2">
            {activity.map((item) => (
              <div key={item.title} className="flex items-center gap-2">
                <item.icon className={cn("size-3.5", item.accent)} />
                <span className="text-[11px] font-medium text-foreground">
                  {item.title}
                </span>
                <span className="truncate text-[10px] text-muted-foreground">
                  {item.meta}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
