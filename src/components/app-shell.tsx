import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Link, useParams } from "@tanstack/react-router"
import { rememberWorkspace } from "@/lib/last-workspace"
import type { WorkspaceListItem } from "@/server/services/workspace-service"
import {
  getWorkspaceFn,
  listWorkspaceMembersFn,
  listWorkspacesFn,
} from "@/server/functions/workspaces"

export interface Crumb {
  label: string
  /** Typed router destination. Use `to`/`params` for client-side navigation. */
  to?: string
  params?: Record<string, string>
}

export function AppShell({
  children,
  crumbs,
}: {
  children: ReactNode
  crumbs: Crumb[]
}) {
  const params = useParams({ strict: false }) as
    { workspaceSlug?: string } | undefined
  const workspaceSlug = params?.workspaceSlug

  const [workspaces, setWorkspaces] = useState<WorkspaceListItem[] | null>(null)
  const [teamCount, setTeamCount] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    listWorkspacesFn()
      .then((items) => {
        if (!cancelled) setWorkspaces(items)
      })
      .catch(() => {
        if (!cancelled) setWorkspaces([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!workspaceSlug) {
      setTeamCount(null)
      return
    }
    // Every workspace route funnels through the shell, so this is the
    // single place that records "last opened workspace".
    rememberWorkspace(workspaceSlug)
    let cancelled = false
    setTeamCount(null)
    ;(async () => {
      try {
        const access = await getWorkspaceFn({ data: { slug: workspaceSlug } })
        const members = await listWorkspaceMembersFn({
          data: { workspaceId: access.workspace.id },
        })
        if (!cancelled) setTeamCount(members.length)
      } catch {
        if (!cancelled) setTeamCount(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [workspaceSlug])

  return (
    <SidebarProvider>
      <AppSidebar workspaces={workspaces} teamCount={teamCount} />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              {crumbs.map((crumb, index) => {
                const last = index === crumbs.length - 1
                return (
                  <span key={crumb.label} className="contents">
                    <BreadcrumbItem>
                      {last || !crumb.to ? (
                        <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink asChild>
                          <Link
                            to={crumb.to}
                            params={crumb.params}
                            className="hover:text-foreground"
                          >
                            {crumb.label}
                          </Link>
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                    {!last && <BreadcrumbSeparator />}
                  </span>
                )
              })}
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
