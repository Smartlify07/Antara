import { useState } from "react"
import { useRouter } from "@tanstack/react-router"
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
import type { ProjectListItem } from "@/server/services/project-service"
import type { ProjectStatus } from "@/db/enums"
import { setProjectStatusFn, trashProjectFn } from "@/server/functions/projects"
import { formatDueDate, isOverdue } from "@/lib/time"
import {
  AlarmClockIcon,
  ArchiveIcon,
  ArchiveRestoreIcon,
  CircleCheckBigIcon,
  ClockIcon,
  ListTodoIcon,
  Loader2,
  MessageCircleIcon,
  MoreHorizontalIcon,
  PauseCircleIcon,
  SparklesIcon,
  Trash2Icon,
  UsersIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

const STATUS_META: Record<
  ProjectStatus,
  { label: string; icon: typeof ClockIcon; className: string }
> = {
  planning: {
    label: "Planning",
    icon: SparklesIcon,
    className:
      "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  },
  active: {
    label: "Active",
    icon: ClockIcon,
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  on_hold: {
    label: "On hold",
    icon: PauseCircleIcon,
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
  completed: {
    label: "Completed",
    icon: CircleCheckBigIcon,
    className: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  },
  archived: {
    label: "Archived",
    icon: ArchiveIcon,
    className: "bg-muted text-muted-foreground",
  },
}

interface CardProps {
  project: ProjectListItem
  workspaceId: string
  canManage: boolean
}

function ProjectCard({ project, workspaceId, canManage }: CardProps) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [trashOpen, setTrashOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const meta = STATUS_META[project.status]
  const StatusIcon = meta.icon
  const archived = project.status === "archived"
  const overdue =
    project.deadline !== null &&
    isOverdue(project.deadline) &&
    project.status !== "completed" &&
    !archived

  async function run(action: () => Promise<unknown>) {
    setPending(true)
    setError(null)
    try {
      await action()
      await router.invalidate()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.")
    } finally {
      setPending(false)
      setTrashOpen(false)
    }
  }

  return (
    <Card className="group/card gap-0 py-0">
      <div className="relative">
        <ProjectCoverArt
          seed={project.slug}
          gradient={{
            start: project.gradientStart,
            end: project.gradientEnd,
          }}
          className="h-32"
        />

        {canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={pending}
                aria-label={`Actions for ${project.title}`}
                className="absolute top-3 right-3 text-background"
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
                  void run(() =>
                    setProjectStatusFn({
                      data: {
                        workspaceId,
                        projectId: project.id,
                        status: archived ? "active" : "archived",
                      },
                    })
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

      <CardHeader className="gap-3 px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="line-clamp-2 text-lg leading-snug font-medium tracking-tight">
            {project.title}
          </CardTitle>
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
              meta.className
            )}
          >
            <StatusIcon className="size-3" />
            {meta.label}
          </span>
        </div>

        {project.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {project.tags.map((tag) => (
              <span
                key={tag.id}
                className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground"
              >
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

export function ProjectsGrid({
  projects,
  workspaceId,
  canManage,
}: {
  projects: ProjectListItem[]
  workspaceId: string
  canManage: boolean
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          workspaceId={workspaceId}
          canManage={canManage}
        />
      ))}
    </div>
  )
}
