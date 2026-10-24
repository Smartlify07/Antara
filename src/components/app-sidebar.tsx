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
import { CircleCheckBigIcon } from "@/components/animate-ui/icons/circle-check-big"
import { ClipboardListIcon } from "@/components/animate-ui/icons/clipboard-list"
import { EyeIcon } from "@/components/animate-ui/icons/eye"
import { ImageIcon } from "@/components/animate-ui/icons/image"
import { KanbanIcon } from "@/components/animate-ui/icons/kanban"
import { MailOpenIcon } from "@/components/animate-ui/icons/mail-open"
import { UsersIcon } from "@/components/animate-ui/icons/users"

export interface RequestBadgeState {
  canTriage: boolean
  count: number
}

export interface MyTasksBadgeState {
  count: number
}

export interface ReviewQueueBadgeState {
  canReview: boolean
  count: number
}

export function AppSidebar({
  workspaces,
  teamCount,
  requestsBadge,
  myTasksBadge,
  reviewsBadge,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  workspaces: WorkspaceListItem[] | null
  teamCount: number | null
  requestsBadge: RequestBadgeState | null
  myTasksBadge: MyTasksBadgeState | null
  reviewsBadge: ReviewQueueBadgeState | null
}) {
  const location = useLocation()
  const match = location.pathname.match(/^\/w\/([^/]+)/)
  const activeSlug = match?.[1]
  const inWorkspace = Boolean(activeSlug)

  const workspaceItems = [
    ...(inWorkspace && activeSlug
      ? [
          {
            title: "Projects",
            url: `/w/${activeSlug}/projects`,
            icon: <KanbanIcon />,
            // Naive "any other section" check — every new workspace section
            // must be excluded here, same as /team and /requests.
            active:
              !location.pathname.includes("/team") &&
              !location.pathname.includes("/requests") &&
              !location.pathname.includes("/my-tasks") &&
              !location.pathname.includes("/reviews") &&
              !location.pathname.includes("/library"),
          },
          {
            title: "Requests",
            url: `/w/${activeSlug}/requests`,
            icon: <ClipboardListIcon />,
            badge:
              requestsBadge &&
              requestsBadge.canTriage &&
              requestsBadge.count > 0
                ? String(requestsBadge.count)
                : undefined,
            active: location.pathname.startsWith(`/w/${activeSlug}/requests`),
          },
          // Reviewers only (server-stamped): a member who never submits work
          // for others' review has no queue, so the entry doesn't either.
          ...(reviewsBadge && reviewsBadge.canReview
            ? [
                {
                  title: "Reviews",
                  url: `/w/${activeSlug}/reviews`,
                  icon: <EyeIcon />,
                  badge:
                    reviewsBadge.count > 0
                      ? String(reviewsBadge.count)
                      : undefined,
                  active: location.pathname.startsWith(
                    `/w/${activeSlug}/reviews`
                  ),
                },
              ]
            : []),
          {
            title: "Library",
            url: `/w/${activeSlug}/library`,
            icon: <ImageIcon />,
            active: location.pathname.startsWith(`/w/${activeSlug}/library`),
          },
          {
            title: "Team",
            url: `/w/${activeSlug}/team`,
            icon: <UsersIcon />,
            badge: teamCount === null ? undefined : String(teamCount),
            active: location.pathname === `/w/${activeSlug}/team`,
          },
        ]
      : []),
  ]

  const personalItems = [
    // Tasks are workspace-scoped work (every task belongs to a project), so
    // the entry exists only inside a workspace. The badge is a count, not
    // authority: being assigned work is the fact, unlike the requests badge.
    ...(inWorkspace && activeSlug
      ? [
          {
            title: "My tasks",
            url: `/w/${activeSlug}/my-tasks`,
            icon: <CircleCheckBigIcon />,
            badge:
              myTasksBadge && myTasksBadge.count > 0
                ? String(myTasksBadge.count)
                : undefined,
            active: location.pathname.startsWith(`/w/${activeSlug}/my-tasks`),
          },
        ]
      : []),
    {
      title: "Inbox",
      icon: <MailOpenIcon />,
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
