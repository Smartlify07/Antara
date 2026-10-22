import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { BellIcon, CheckIcon } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { avatarTint } from "@/lib/avatar-tint"
import { Skeleton } from "@/components/ui/skeleton"
import {
  notificationKeys,
  notificationsQuery,
  unreadCountQuery,
} from "@/lib/queries/notifications"
import { formatRelativeTime } from "@/lib/time"
import { cn } from "@/lib/utils"
import {
  markAllNotificationsReadFn,
  markNotificationReadFn,
} from "@/server/functions/notifications"
import type {
  NotificationCopyPart,
  NotificationItem,
} from "@/server/services/notification-service"

/**
 * The notification bell (FR-048..050): an always-mounted unread counter with
 * an orb, a popover inbox, and subject deep-links. No new route — the bell is
 * shell furniture, the same class of affordance as the workspace switcher.
 *
 * Freshness comes from the query options (focus refetch + 30s interval) —
 * nothing here listens to sockets, per the plan.
 */

/** The unread row's dot. Shared by the bell badge and each inbox row. */
function UnreadOrb({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("size-2 shrink-0 rounded-full bg-primary", className)}
    />
  )
}

export function NotificationsBell({
  workspaceSlug,
}: {
  workspaceSlug: string
}) {
  const [open, setOpen] = useState(false)
  const { data: unread = 0 } = useQuery(unreadCountQuery(workspaceSlug))
  // Observed from page load, not on open: the inbox renders an already-warm
  // cache, so clicking the bell costs no fetch. The list rides the same
  // freshness options as the badge.
  const list = useQuery(notificationsQuery(workspaceSlug))

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={
            unread > 0 ? `Notifications (${unread} unread)` : "Notifications"
          }
          className="relative flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-open:bg-muted data-open:text-foreground"
        >
          <BellIcon className="size-4" />
          {unread > 0 && (
            // The badge orb is the destructive red — unread demands attention,
            // and it does not read as just another dark dot on the shell.
            <UnreadOrb className="absolute top-1 right-1 bg-destructive ring-2 ring-background" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[22rem] p-0"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <NotificationsInbox
          workspaceSlug={workspaceSlug}
          unreadCount={unread}
          items={list.data}
          isPending={list.isPending}
          error={list.error}
          onClose={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  )
}

/**
 * The row copy, with the actor's name given weight so names read at a glance.
 * An unread row's whole line is already medium, so the name steps up to
 * semibold there; a read row's name is medium over plain text.
 */
function MessageText({
  parts,
  focus,
}: {
  parts: NotificationCopyPart[]
  focus: boolean
}) {
  return (
    <>
      {parts.map((part, index) =>
        part.actor ? (
          <span key={index} className={focus ? "font-semibold" : "font-medium"}>
            {part.text}
          </span>
        ) : (
          <span key={index}>{part.text}</span>
        )
      )}
    </>
  )
}

function NotificationsInbox({
  workspaceSlug,
  unreadCount,
  items,
  isPending,
  error,
  onClose,
}: {
  workspaceSlug: string
  unreadCount: number
  items?: NotificationItem[]
  isPending: boolean
  error: Error | null
  onClose: () => void
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const unreadKey = notificationKeys.unread(workspaceSlug)
  const listKey = notificationKeys.list(workspaceSlug)

  const markRead = useMutation({
    mutationFn: (notificationId: string) =>
      markNotificationReadFn({
        data: { workspaceSlug, notificationId },
      }),
    // Optimism is scoped: the row goes read instantly, and the badge only
    // dips when that row was still unread in the cache — so a stale double
    // click cannot walk the count below zero before the refetch corrects it.
    onMutate: async (notificationId) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: unreadKey }),
        queryClient.cancelQueries({ queryKey: listKey }),
      ])
      const previousCount = queryClient.getQueryData<number>(unreadKey)
      const previousList = queryClient.getQueryData<NotificationItem[]>(listKey)

      const row = previousList?.find((item) => item.id === notificationId)
      if (row && !row.readAt) {
        queryClient.setQueryData(listKey, (list?: NotificationItem[]) =>
          list?.map((item) =>
            item.id === notificationId ? { ...item, readAt: new Date() } : item
          )
        )
        queryClient.setQueryData(unreadKey, (count?: number) =>
          typeof count === "number"
            ? Math.max(0, count - 1)
            : Math.max(0, (previousCount ?? 0) - 1)
        )
      }
      return { previousCount, previousList }
    },
    onError: (_error, _id, context) => {
      if (context?.previousCount !== undefined) {
        queryClient.setQueryData(unreadKey, context.previousCount)
      }
      if (context?.previousList) {
        queryClient.setQueryData(listKey, context.previousList)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: unreadKey })
      void queryClient.invalidateQueries({ queryKey: listKey })
    },
  })

  const markAllRead = useMutation({
    mutationFn: () => markAllNotificationsReadFn({ data: { workspaceSlug } }),
    onMutate: async () => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: unreadKey }),
        queryClient.cancelQueries({ queryKey: listKey }),
      ])
      const previousCount = queryClient.getQueryData<number>(unreadKey)
      const previousList = queryClient.getQueryData<NotificationItem[]>(listKey)
      queryClient.setQueryData(listKey, (list?: NotificationItem[]) =>
        list?.map((item) =>
          item.readAt ? item : { ...item, readAt: new Date() }
        )
      )
      queryClient.setQueryData(unreadKey, 0)
      return { previousCount, previousList }
    },
    onError: (_error, _id, context) => {
      if (context?.previousCount !== undefined) {
        queryClient.setQueryData(unreadKey, context.previousCount)
      }
      if (context?.previousList) {
        queryClient.setQueryData(listKey, context.previousList)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: unreadKey })
      void queryClient.invalidateQueries({ queryKey: listKey })
    },
  })

  /** Mark read, close, then jump — the subject, not just the module. */
  function openNotification(item: NotificationItem) {
    if (!item.readAt) markRead.mutate(item.id)
    onClose()
    if (item.subjectType === "task") {
      // A task has no page of its own; "My tasks" with the task in view is
      // the concrete subject surface (it only ever receives assignment
      // notifications, so the task is the viewer's own work).
      void navigate({
        to: "/w/$workspaceSlug/my-tasks",
        params: { workspaceSlug },
        search: { task: item.subjectId },
      })
      return
    }
    if (item.projectSlug) {
      void navigate({
        to: "/w/$workspaceSlug/projects/$projectSlug",
        params: { workspaceSlug, projectSlug: item.projectSlug },
      })
    }
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <p className="text-sm font-semibold tracking-tight">Notifications</p>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="xs"
            className="text-muted-foreground"
            disabled={markAllRead.isPending}
            onClick={() => markAllRead.mutate()}
          >
            <CheckIcon />
            Mark all read
          </Button>
        )}
      </div>

      {isPending ? (
        <div className="flex flex-col gap-2 px-3 pb-3">
          {[0, 1, 2].map((row) => (
            <div key={row} className="flex items-start gap-2.5">
              <Skeleton className="size-7 rounded-full" />
              <div className="flex-1 space-y-1.5 py-0.5">
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-2.5 w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <p role="alert" className="px-3 pb-4 text-sm text-destructive">
          Could not load notifications.
        </p>
      ) : (items ?? []).length === 0 ? (
        <div className="flex flex-col items-center gap-1 px-6 pt-4 pb-8 text-center">
          <BellIcon
            aria-hidden
            className="mb-1 size-5 text-muted-foreground/60"
          />
          <p className="text-sm font-medium">All caught up</p>
          <p className="text-xs text-muted-foreground">
            Project, task, and review updates will land here.
          </p>
        </div>
      ) : (
        <ul className="max-h-[24rem] overflow-y-auto overscroll-contain pb-2">
          {(items ?? []).map((item) => (
            <li key={item.id} className="group/row relative">
              <button
                type="button"
                onClick={() => openNotification(item)}
                className={cn(
                  "flex w-full gap-2.5 px-3 py-2.5 text-left transition-colors outline-none",
                  item.readAt
                    ? "hover:bg-muted/60"
                    : "bg-primary/[0.06] hover:bg-primary/10"
                )}
              >
                <Avatar className="mt-0.5 size-7 shrink-0">
                  {item.actor.image && (
                    <AvatarImage src={item.actor.image} alt="" />
                  )}
                  <AvatarFallback
                    className={cn(
                      "text-[11px] font-medium",
                      // The tint the person carries everywhere (seeded by their
                      // id), matching profile pictures across the product.
                      avatarTint(
                        item.actor.id ??
                          item.actor.name ??
                          item.actor.email ??
                          "former-member"
                      )
                    )}
                  >
                    {(
                      item.actor.name?.trim()[0] ??
                      item.actor.email?.trim()[0] ??
                      "?"
                    ).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span
                    className={cn(
                      "text-[0.8rem] leading-snug",
                      !item.readAt && "font-medium"
                    )}
                  >
                    <MessageText
                      parts={item.messageParts}
                      focus={!item.readAt}
                    />
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeTime(item.createdAt)}
                  </span>
                </span>
                {!item.readAt && (
                  <span className="mt-1.5">
                    <UnreadOrb />
                  </span>
                )}
              </button>
              {!item.readAt && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Mark read"
                  className="absolute top-3 right-6 text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100"
                  onClick={(event) => {
                    event.stopPropagation()
                    markRead.mutate(item.id)
                  }}
                >
                  <CheckIcon />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
