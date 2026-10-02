import { useLocation } from "@tanstack/react-router"
import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { WorkspaceSearch } from "@/components/workspace-search"
import { WorkspaceSwitcher } from "@/components/workspace-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import type { WorkspaceListItem } from "@/server/services/workspace-service"
import {
  FolderKanbanIcon,
  ImagesIcon,
  InboxIcon,
  LayoutDashboardIcon,
  SquareCheckBigIcon,
  UsersIcon,
} from "lucide-react"

export function AppSidebar({
  workspaces,
  teamCount,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  workspaces: WorkspaceListItem[] | null
  teamCount: number | null
}) {
  const location = useLocation()
  const match = location.pathname.match(/^\/w\/([^/]+)/)
  const activeSlug = match?.[1]
  const inWorkspace = Boolean(activeSlug)

  const workspaceItems = [
    ...(inWorkspace && activeSlug
      ? [
          {
            title: "Overview",
            url: `/w/${activeSlug}`,
            icon: <LayoutDashboardIcon />,
            active: location.pathname === `/w/${activeSlug}`,
          },
        ]
      : []),
    {
      title: "Projects",
      icon: <FolderKanbanIcon />,
      badge: "Soon",
      items: [
        { title: "All projects", badge: "Soon" },
        { title: "Active", badge: "Soon" },
        { title: "Archived", badge: "Soon" },
      ],
    },
    ...(inWorkspace && activeSlug
      ? [
          {
            title: "Team",
            url: `/w/${activeSlug}/team`,
            icon: <UsersIcon />,
            badge: teamCount === null ? undefined : String(teamCount),
            active: location.pathname === `/w/${activeSlug}/team`,
          },
        ]
      : []),
    {
      title: "Assets",
      icon: <ImagesIcon />,
      badge: "Soon",
    },
  ]

  const personalItems = [
    {
      title: "My tasks",
      icon: <SquareCheckBigIcon />,
      badge: "Soon",
    },
    {
      title: "Inbox",
      icon: <InboxIcon />,
      badge: "Soon",
    },
  ]

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="gap-2">
        <WorkspaceSwitcher workspaces={workspaces} />
        <WorkspaceSearch workspaces={workspaces ?? []} fullWidth />
      </SidebarHeader>
      <SidebarContent>
        <NavMain label="Workspace" items={workspaceItems} />
        <NavMain label="You" items={personalItems} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
