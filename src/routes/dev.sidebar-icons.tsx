import { createFileRoute } from "@tanstack/react-router"
import { CircleCheckBigIcon } from "@/components/animate-ui/icons/circle-check-big"
import { ClipboardListIcon } from "@/components/animate-ui/icons/clipboard-list"
import { EyeIcon } from "@/components/animate-ui/icons/eye"
import { ImageIcon } from "@/components/animate-ui/icons/image"
import { KanbanIcon } from "@/components/animate-ui/icons/kanban"
import { MailOpenIcon } from "@/components/animate-ui/icons/mail-open"
import { UsersIcon } from "@/components/animate-ui/icons/users"
import { NavMain } from "@/components/nav-main"
import type { NavEntry } from "@/components/nav-main"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"

export const Route = createFileRoute("/dev/sidebar-icons")({
  component: SidebarIconsGallery,
})

const workspaceItems: NavEntry[] = [
  { title: "Projects", url: "#", icon: <KanbanIcon />, active: true },
  { title: "Requests", url: "#", icon: <ClipboardListIcon />, badge: "3" },
  { title: "Reviews", url: "#", icon: <EyeIcon /> },
  { title: "Library", url: "#", icon: <ImageIcon /> },
  { title: "Team", url: "#", icon: <UsersIcon />, badge: "8" },
]

const personalItems: NavEntry[] = [
  { title: "My tasks", url: "#", icon: <CircleCheckBigIcon />, badge: "5" },
  { title: "Inbox", icon: <MailOpenIcon />, badge: "Soon" },
]

/**
 * Concept sprint · mock data. Isolates the Animate UI hover wiring so the
 * navigation rows can be hovered (or tabbed — focus animates too) with the
 * real sidebar chrome, before the animated icons land in AppSidebar.
 */
function SidebarIconsGallery() {
  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <p className="px-2 py-1.5 text-sm font-semibold">Dev gallery</p>
        </SidebarHeader>
        <SidebarContent>
          <NavMain
            label="Hover each row"
            items={[...workspaceItems, ...personalItems]}
          />
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <div className="p-8">
          <SidebarTrigger />
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Animated sidebar icons
          </h1>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Hover (or tab into) a row to play its icon once. Click the trigger
            to check the icon-collapsed rail. Workspace section rows mirror
            AppSidebar's entries.
          </p>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
