import { Link, useLocation, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import type { WorkspaceListItem } from "@/server/services/workspace-service"
import { CheckIcon, ChevronsUpDownIcon, PlusIcon } from "lucide-react"
import { cn } from "@/lib/utils"

function WorkspaceMark({
  title,
  avatarUrl,
  size,
}: {
  title: string
  avatarUrl: string | null
  size: "md" | "sm"
}) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className={cn(
          "object-cover ring-1 ring-black/10 ring-inset",
          size === "md" ? "size-8 rounded-lg" : "size-6 rounded-md"
        )}
      />
    )
  }
  return (
    <span
      aria-hidden
      className={cn(
        "flex items-center justify-center bg-sidebar-primary font-medium text-sidebar-primary-foreground",
        size === "md"
          ? "size-8 rounded-lg text-sm"
          : "size-6 rounded-md text-xs"
      )}
    >
      {(title.trim()[0] ?? "W").toUpperCase()}
    </span>
  )
}

export function WorkspaceSwitcher({
  workspaces,
}: {
  workspaces: WorkspaceListItem[] | null
}) {
  const { isMobile } = useSidebar()
  const location = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  if (workspaces === null) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <div className="flex items-center gap-2 px-1 py-1">
            <Skeleton className="size-8 rounded-lg" />
            <div className="flex flex-1 flex-col gap-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-2.5 w-16" />
            </div>
          </div>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  const activeSlug = location.pathname.match(/^\/w\/([^/]+)/)?.[1]
  const active =
    workspaces.find((item) => item.workspace.slug === activeSlug) ??
    workspaces[0]

  if (!active) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild size="lg" tooltip="Create workspace">
            <Link to="/workspaces/new">
              <span className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <PlusIcon className="size-4" />
              </span>
              <span className="truncate font-medium">New workspace</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <WorkspaceMark
                title={active.workspace.title}
                avatarUrl={active.workspace.avatarUrl}
                size="md"
              />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">
                  {active.workspace.title}
                </span>
                <span className="truncate text-xs">
                  {active.isOwner ? "owner" : active.role}
                </span>
              </div>
              <ChevronsUpDownIcon className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-56"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Workspaces
            </DropdownMenuLabel>
            {workspaces.map((item) => (
              <DropdownMenuItem
                key={item.workspace.id}
                className="gap-2 p-2"
                onClick={() => {
                  setOpen(false)
                  void navigate({
                    to: "/w/$workspaceSlug/projects",
                    params: { workspaceSlug: item.workspace.slug },
                  })
                }}
              >
                <WorkspaceMark
                  title={item.workspace.title}
                  avatarUrl={item.workspace.avatarUrl}
                  size="sm"
                />
                <span className="flex-1 truncate">{item.workspace.title}</span>
                {item.workspace.id === active.workspace.id && (
                  <CheckIcon className="size-4 shrink-0" />
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 p-2" asChild>
              <Link to="/workspaces/new">
                <span className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                  <PlusIcon className="size-4" />
                </span>
                <span className="font-medium text-muted-foreground">
                  New workspace
                </span>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
