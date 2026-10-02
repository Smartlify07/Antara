import { Link } from "@tanstack/react-router"
import type { ReactNode } from "react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { ChevronRightIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export interface NavSubEntry {
  title: string
  badge?: string
}

export interface NavEntry {
  title: string
  url?: string
  icon?: ReactNode
  badge?: string
  active?: boolean
  items?: NavSubEntry[]
}

function SoonBadge() {
  return (
    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
      Soon
    </span>
  )
}

export function NavMain({
  label,
  items,
}: {
  label: string
  items: NavEntry[]
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          if (!item.items) {
            const button = (
              <SidebarMenuButton
                tooltip={item.title}
                isActive={item.active}
                disabled={!item.url}
                className={cn(!item.url && "opacity-70")}
              >
                {item.icon}
                <span>{item.title}</span>
                {item.badge && <SoonBadge />}
              </SidebarMenuButton>
            )
            return (
              <SidebarMenuItem key={item.title}>
                {item.url ? (
                  <SidebarMenuButton
                    asChild
                    tooltip={item.title}
                    isActive={item.active}
                  >
                    <Link to={item.url}>
                      {item.icon}
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                ) : (
                  button
                )}
              </SidebarMenuItem>
            )
          }
          return (
            <Collapsible
              key={item.title}
              asChild
              defaultOpen={item.active}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton tooltip={item.title}>
                    {item.icon}
                    <span>{item.title}</span>
                    {item.badge && <SoonBadge />}
                    <ChevronRightIcon className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {item.items.map((subItem) => (
                      <SidebarMenuSubItem key={subItem.title}>
                        <SidebarMenuSubButton aria-disabled="true">
                          <span>{subItem.title}</span>
                          {subItem.badge && <SoonBadge />}
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
