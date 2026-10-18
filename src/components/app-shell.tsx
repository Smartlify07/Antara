import type { ReactNode } from "react"
import { useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
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
import { NotificationsBell } from "@/components/notifications/notification-bell"
import { requestBadgeQuery } from "@/lib/queries/requests"
import { myTasksBadgeQuery } from "@/lib/queries/tasks"
import { reviewQueueBadgeQuery } from "@/lib/queries/versions"
import {
  workspaceTeamCountQuery,
  workspacesQuery,
} from "@/lib/queries/workspaces"
import { touchWorkspaceFn } from "@/server/functions/workspaces"

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
  const params = useParams({ strict: false })
  const workspaceSlug = params.workspaceSlug

  const { data: workspaces } = useQuery(workspacesQuery())

  const { data: teamCount } = useQuery({
    ...workspaceTeamCountQuery(workspaceSlug ?? ""),
    enabled: !!workspaceSlug,
  })

  const { data: requestsBadge } = useQuery({
    ...requestBadgeQuery(workspaceSlug ?? ""),
    enabled: !!workspaceSlug,
  })

  const { data: myTasksBadge } = useQuery({
    ...myTasksBadgeQuery(workspaceSlug ?? ""),
    enabled: !!workspaceSlug,
  })

  const { data: reviewsBadge } = useQuery({
    ...reviewQueueBadgeQuery(workspaceSlug ?? ""),
    enabled: !!workspaceSlug,
  })

  useEffect(() => {
    if (!workspaceSlug) return

    // Every workspace route funnels through the shell, so this is the single
    // place that records "last opened workspace".
    //
    // Debounced rather than written straight away. Switching A → B → A quickly
    // should record A, but two immediate writes would leave B as the most
    // recent and drop the user into the workspace they left. The timer is
    // cleared on every slug change, so only the final destination survives and
    // rapid switching costs one write rather than one per hop.
    //
    // A server-side time guard was rejected for the same reason: it would skip
    // the write on the way back and reintroduce exactly that staleness.
    const touchTimer = setTimeout(() => {
      void touchWorkspaceFn({ data: { slug: workspaceSlug } })
    }, 400)

    return () => clearTimeout(touchTimer)
  }, [workspaceSlug])

  return (
    <SidebarProvider>
      <AppSidebar
        workspaces={workspaces ?? null}
        teamCount={teamCount ?? null}
        requestsBadge={requestsBadge ?? null}
        myTasksBadge={myTasksBadge ?? null}
        reviewsBadge={reviewsBadge ?? null}
      />
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
          {/* The bell is shell furniture, and only means something inside a
              workspace — its badge and inbox are scoped to the slug. */}
          {workspaceSlug && (
            <div className="ml-auto">
              <NotificationsBell workspaceSlug={workspaceSlug} />
            </div>
          )}
        </header>
        <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-4 px-4 py-4 sm:py-6">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
