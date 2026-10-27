import { Link } from "@tanstack/react-router"
import { useState } from "react"
import type { ReactNode } from "react"
import { AnimateIcon } from "@animate-ui/react/icons"
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

/**
 * Badges carry either the alt text "Soon" (a placeholder surface) or a
 * number (a live count — Requests' queue, Team's roster). Across the
 * collapsed sidebar both hide with the labels.
 */
function NavBadge({ label }: { label: string }) {
  if (label === "Soon") return <SoonBadge />
  return (
    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground tabular-nums">
      {label}
    </span>
  )
}

/**
 * The icon wrapper knows the animation; the row knows the hover. Nesting an
 * animated icon inside AnimateIcon hands it the provider's animation controls,
 * so a pointer (or focus) anywhere on the nav row animates the icon — not just
 * hover on the 16px glyph itself.
 */
function NavIcon({
  active,
  children,
}: {
  active: boolean
  children: ReactNode
}) {
  return (
    <AnimateIcon animate={active} className="shrink-0">
      {children}
    </AnimateIcon>
  )
}

function useRowActive() {
  const [active, setActive] = useState(false)
  return {
    active,
    activeProps: {
      onMouseEnter: () => setActive(true),
      onMouseLeave: () => setActive(false),
      onFocus: () => setActive(true),
      onBlur: () => setActive(false),
    },
  }
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
        {items.map((item) => (
          <NavRow key={item.title} item={item} />
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}

function NavRow({ item }: { item: NavEntry }) {
  const { active, activeProps } = useRowActive()
  const icon = <NavIcon active={active}>{item.icon}</NavIcon>

  if (item.items) {
    return (
      <Collapsible
        asChild
        defaultOpen={item.active}
        className="group/collapsible"
      >
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton tooltip={item.title} {...activeProps}>
              {icon}
              <span>{item.title}</span>
              {item.badge && <NavBadge label={item.badge} />}
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
  }

  const button = (
    <SidebarMenuButton
      tooltip={item.title}
      isActive={item.active}
      disabled={!item.url}
      className={cn(!item.url && "opacity-70")}
      {...activeProps}
    >
      {icon}
      <span>{item.title}</span>
      {item.badge && <NavBadge label={item.badge} />}
    </SidebarMenuButton>
  )

  if (item.url) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton asChild tooltip={item.title} isActive={item.active}>
          <Link to={item.url} {...activeProps}>
            {icon}
            <span>{item.title}</span>
            {item.badge && <NavBadge label={item.badge} />}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  return <SidebarMenuItem>{button}</SidebarMenuItem>
}
