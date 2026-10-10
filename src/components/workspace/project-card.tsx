import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ProjectCoverArt } from "@/components/workspace/project-cover-art"
import { TagDot } from "@/components/projects/tags-chip"
import type { ProjectListItem } from "@/server/services/project-service"
import type { OptimisticProject } from "@/lib/queries/projects"
import { projectKeys } from "@/lib/queries/projects"
import { setProjectStatusFn, trashProjectFn } from "@/server/functions/projects"
import { formatDueDate, isOverdue } from "@/lib/time"
import { PROJECT_STATUS_META } from "@/lib/status-meta"
import { Link } from "@tanstack/react-router"
import {
  AlarmClockIcon,
  ArchiveIcon,
  ArchiveRestoreIcon,
  ClockIcon,
  ListTodoIcon,
  Loader2,
  MessageCircleIcon,
  MoreHorizontalIcon,
  Trash2Icon,
  UsersIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

export function ProjectCard({
  project,
  workspaceId,
  workspaceSlug,
  canManage,
  optimistic = false,
}: {
  project: ProjectListItem | OptimisticProject
  workspaceId: string
  /** Needed to build the link into the details route. */
  workspaceSlug: string
  canManage: boolean
  /** True while the server write is still in flight. */
  optimistic?: boolean
}) {
  const client = useQueryClient()
  const [pending, setPending] = useState(false)
  const [trashOpen, setTrashOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const meta = PROJECT_STATUS_META[project.status]
  const StatusIcon = meta.icon
  const archived = project.status === "archived"
  const overdue =
    project.deadline !== null &&
    isOverdue(project.deadline) &&
    project.status !== "completed" &&
    !archived

  // Nothing can be mutated until the row exists server-side, so the action
  // menu stays hidden for an optimistic row.
  const actionsEnabled = canManage && !optimistic

  // Targeted invalidation: only the projects list for this workspace
  // refetches. `router.invalidate()` refetched every active loader in the app,
  // so trashing one card also reloaded the workspace sidebar, team members
  // and the tag vocabulary.
  //
  // `patch` applies the change to the list cache before the write, so the card
  // reflects archive/restore the moment it is clicked. The snapshot restores it
  // if the request fails, and the invalidation still runs so the server's row
  // wins either way.
  async function run(
    action: () => Promise<unknown>,
    patch?: (current: ProjectListItem[]) => ProjectListItem[]
  ) {
    setPending(true)
    setError(null)

    const key = projectKeys.list(workspaceId)
    const snapshot = client.getQueryData<ProjectListItem[]>(key)
    if (patch && snapshot) {
      client.setQueryData(key, patch)
    }

    try {
      await action()
    } catch (e) {
      if (snapshot) client.setQueryData(key, snapshot)
      setError(e instanceof Error ? e.message : "Something went wrong.")
      setPending(false)
      setTrashOpen(false)
      return
    }

    await client.invalidateQueries({ queryKey: key })
    setPending(false)
    setTrashOpen(false)
  }

  /** Applies a status change to just this project's row in the cache. */
  function withStatus(status: ProjectListItem["status"]) {
    return (current: ProjectListItem[]) =>
      current.map((row) => (row.id === project.id ? { ...row, status } : row))
  }

  return (
    <Card className="group/card h-full gap-0 py-0">
      {/* Wrapping the cover art in a link is what makes the card navigable.
          An optimistic row is excluded — the detail route resolves by slug and
          would 404 on a project the server has not created yet. The header
          keeps its own title link so the whole card is reachable by mouse
          without nesting two anchors on one target. */}
      {!optimistic ? (
        <Link
          to="/w/$workspaceSlug/projects/$projectSlug"
          params={{
            workspaceSlug,
            projectSlug: project.slug,
          }}
          className="block focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <ProjectCoverArt
            seed={project.slug}
            gradient={{
              start: project.gradientStart,
              end: project.gradientEnd,
            }}
            className="h-44"
          />
        </Link>
      ) : (
        <ProjectCoverArt
          seed={project.slug}
          gradient={{
            start: project.gradientStart,
            end: project.gradientEnd,
          }}
          className="h-44"
        />
      )}

      <CardHeader className="gap-3 px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="line-clamp-2 text-lg leading-snug font-medium tracking-tight">
            {optimistic ? (
              project.title
            ) : (
              <Link
                to="/w/$workspaceSlug/projects/$projectSlug"
                params={{ workspaceSlug, projectSlug: project.slug }}
                className="hover:underline"
              >
                {project.title}
              </Link>
            )}
          </CardTitle>

          <div className="flex shrink-0 items-center gap-1">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
                meta.badgeClass
              )}
            >
              <StatusIcon className="size-3" />
              {meta.label}
            </span>

            {actionsEnabled && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={pending}
                    aria-label={`Actions for ${project.title}`}
                    className="text-muted-foreground"
                  >
                    {pending ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <MoreHorizontalIcon />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    disabled={pending}
                    onSelect={() =>
                      void run(
                        () =>
                          setProjectStatusFn({
                            data: {
                              workspaceId,
                              projectId: project.id,
                              status: archived ? "active" : "archived",
                            },
                          }),
                        withStatus(archived ? "active" : "archived")
                      )
                    }
                  >
                    {archived ? <ArchiveRestoreIcon /> : <ArchiveIcon />}
                    {archived ? "Unarchive" : "Archive"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={pending}
                    onSelect={() => setTrashOpen(true)}
                  >
                    <Trash2Icon />
                    Move to trash
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {project.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {project.tags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground"
              >
                <TagDot color={tag.color} />
                {tag.label}
              </span>
            ))}
          </div>
        )}
      </CardHeader>

      <div className="mt-auto flex flex-col gap-2 px-4 pt-1 pb-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <UsersIcon className="size-3.5" />
          {project.memberCount}{" "}
          {project.memberCount === 1 ? "member" : "members"}
        </span>

        <span className="inline-flex items-center gap-1.5">
          <ListTodoIcon className="size-3.5" />
          {project.taskCount} {project.taskCount === 1 ? "task" : "tasks"}
        </span>

        <span className="inline-flex items-center gap-1.5">
          <MessageCircleIcon className="size-3.5" />
          {project.commentCount}{" "}
          {project.commentCount === 1 ? "comment" : "comments"}
        </span>

        {project.deadline && (
          <span
            className={cn(
              "inline-flex items-center gap-1.5",
              overdue && "font-medium text-destructive"
            )}
          >
            {overdue ? (
              <AlarmClockIcon className="size-3.5" />
            ) : (
              <ClockIcon className="size-3.5" />
            )}
            {overdue ? "Overdue " : "Due "}
            {formatDueDate(project.deadline)}
          </span>
        )}

        {error && <span className="text-destructive">{error}</span>}
      </div>

      <AlertDialog open={trashOpen} onOpenChange={setTrashOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Move &ldquo;{project.title}&rdquo; to trash?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The project and its tasks, comments, and assets stop appearing in
              your workspace. There is no restore in the product yet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(e) => {
                e.preventDefault()
                // Deliberately not optimistic. Removing the row from the list
                // unmounts this card, taking the confirm dialog and the error
                // banner with it — so a rejected trash would put the card back
                // with nothing to say why. Archive/restore is patched in place
                // and stays optimistic; trash has nowhere to report from until
                // there is a toast surface.
                void run(() =>
                  trashProjectFn({
                    data: { workspaceId, projectId: project.id },
                  })
                )
              }}
            >
              {pending ? "Moving…" : "Move to trash"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
