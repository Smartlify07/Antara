import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2Icon } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import type { z } from "zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Chip, ChipOption } from "@/components/projects/chip"
import { DateChip } from "@/components/projects/dates-chip"
import { OwnerChip } from "@/components/projects/member-chip"
import { createTaskSchema } from "@/lib/task-schemas"
import { createTaskFn } from "@/server/functions/tasks"
import {
  buildOptimisticTask,
  insertTaskCard,
  taskKeys,
} from "@/lib/queries/tasks"
import type { ProjectTasksCache } from "@/lib/queries/tasks"
import { cn } from "@/lib/utils"
import type { TaskPriority } from "@/db/enums"
import type { AssignableMember } from "@/server/services/project-service"
import { TASK_PRIORITY_META } from "./deliverable-meta"

/**
 * The task creation form (FR-016), laid out like the deliverable create
 * form: a bare title, one row of detail pills (owner, deadline, priority),
 * then the description. The wire schema is the single truth; the form only
 * drops the scope ids it receives as props — the dialog always creates
 * inside one deliverable, and priority rides at Medium, the server's
 * insert default, until a pill moves it.
 */
const newTaskFormSchema = createTaskSchema.omit({
  workspaceId: true,
  projectId: true,
  deliverableId: true,
})

type NewTaskFormInput = z.input<typeof newTaskFormSchema>

/** The pills' option order and dot hues — the meta warn tones as dots. */
const PRIORITY_ORDER: TaskPriority[] = ["low", "medium", "high", "urgent"]

const PRIORITY_DOTS: Record<TaskPriority, string> = {
  low: "bg-muted-foreground/40",
  medium: "bg-muted-foreground/40",
  high: "bg-amber-500",
  urgent: "bg-red-500",
}

export function NewTaskDialog({
  workspaceId,
  projectId,
  deliverableId,
  members,
  children,
  onCreated,
}: {
  workspaceId: string
  projectId: string
  /** The deliverable the task belongs to — this dialog is lane-scoped. */
  deliverableId: string
  /** Project members (the only people a task may be assigned to). */
  members: AssignableMember[]
  children: React.ReactNode
  onCreated: () => void
}) {
  const client = useQueryClient()
  const [open, setOpen] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<NewTaskFormInput>({
    resolver: zodResolver(newTaskFormSchema),
    defaultValues: {
      title: "",
      description: undefined,
      priority: "medium",
      dueDate: undefined,
      assigneeTeamIds: undefined,
    },
  })

  const watchedTitle = form.watch("title")
  const watchedPriority = form.watch("priority")
  const watchedDueDate = form.watch("dueDate")
  const watchedAssignees = form.watch("assigneeTeamIds")

  // Single-owner picker: the label reads the one member the form carries.
  const selectedAssignee =
    members.find((member) => member.teamId === watchedAssignees?.[0]) ?? null

  const tasksKey = taskKeys.byProject(projectId)

  const mutation = useMutation({
    mutationFn: (values: NewTaskFormInput) =>
      createTaskFn({
        data: {
          workspaceId,
          projectId,
          deliverableId,
          title: values.title,
          description: values.description || undefined,
          priority: values.priority,
          dueDate: values.dueDate || undefined,
          assigneeTeamIds: values.assigneeTeamIds?.length
            ? values.assigneeTeamIds
            : undefined,
        },
      }),
    onMutate: async (values) => {
      setServerError(null)
      await client.cancelQueries({ queryKey: tasksKey })

      // Paint-first, same contract as the inline composer the cabinet
      // retired: the row lands in the project's task cache before the
      // request, so the list behind the dialog never blinks. With no cache
      // at all there is nothing to paint into — the settle refetch below
      // is the only writer then.
      const current = client.getQueryData<ProjectTasksCache>(tasksKey)
      if (!current) return { optimisticId: null }

      const optimistic = buildOptimisticTask(
        {
          title: values.title,
          description: values.description || null,
          priority: values.priority,
          dueDate: values.dueDate,
          deliverableId,
          assigneeTeamIds: values.assigneeTeamIds?.length
            ? values.assigneeTeamIds
            : undefined,
        },
        projectId,
        members
      )

      client.setQueryData<ProjectTasksCache>(tasksKey, {
        ...current,
        tasks: insertTaskCard(current.tasks, optimistic),
      })

      return { optimisticId: optimistic.id }
    },
    onError: (caught, _values, context) => {
      // Rollback drops just this task by its optimistic id — the snapshot
      // would also revert anything that landed in the list mid-flight.
      client.setQueryData<ProjectTasksCache>(tasksKey, (existing) =>
        existing
          ? {
              ...existing,
              tasks: existing.tasks.filter(
                (row) => row.id !== context?.optimisticId
              ),
            }
          : existing
      )
      setServerError(
        caught instanceof Error ? caught.message : "Could not create the task."
      )
    },
    onSuccess: () => {
      // Dead fields once the server has the row: the dialog closes on a
      // clean create and reopens empty next time.
      setOpen(false)
      setServerError(null)
      form.reset()
    },
    onSettled: () => {
      // The panel's refresh invalidates the task list this mutation already
      // patched, so the settle refetch swaps the placeholder for server row.
      onCreated()
    },
  })

  async function onSubmit(values: NewTaskFormInput) {
    try {
      await mutation.mutateAsync(values)
    } catch {
      // onError already painted the server error; the form keeps what was
      // typed so the retry is a click, not a retype.
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        // Opening starts clean, mirroring the success path — a half-filled
        // stale form should not sit behind the trigger's second open.
        if (next) {
          setServerError(null)
          form.reset()
        }
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
          <DialogDescription>
            A piece of work inside this deliverable — one owner, one deadline,
            one status.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
          noValidate
        >
          <input
            {...form.register("title")}
            placeholder="Task title"
            aria-label="Task title"
            maxLength={200}
            autoFocus
            className="w-full bg-transparent text-2xl font-medium tracking-tight outline-none placeholder:text-muted-foreground"
          />

          <div className="flex flex-wrap items-center gap-2">
            <OwnerChip
              members={members}
              owner={selectedAssignee}
              placeholder="Assign owner"
              onSelect={(teamId) =>
                form.setValue(
                  "assigneeTeamIds",
                  teamId ? [teamId] : undefined
                )
              }
            />
            <DateChip
              deadline={watchedDueDate ?? null}
              onChange={(deadline) =>
                form.setValue("dueDate", deadline ?? undefined)
              }
            />
            <PriorityChip
              priority={watchedPriority ?? "medium"}
              onChange={(next) => form.setValue("priority", next)}
            />
          </div>

          <div className="border-b" />

          <Textarea
            {...form.register("description")}
            placeholder="What this task covers"
            aria-label="Task description (optional)"
            maxLength={4000}
            className="min-h-[120px] w-full resize-none border-0 bg-transparent text-sm shadow-none focus-visible:ring-0"
          />

          {serverError && (
            <p role="alert" className="text-sm text-destructive">
              {serverError}
            </p>
          )}

          <DialogFooter className="mt-1">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending || !watchedTitle.trim()}
            >
              {mutation.isPending ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" />
                  Creating…
                </>
              ) : (
                "Create task"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * The priority picker as a house pill: the four tones, a dot each, with
 * Medium preselected — the server's create default, mirrored by the
 * optimistic row, so what the pill shows is always what the task will be.
 */
function PriorityChip({
  priority,
  onChange,
}: {
  priority: TaskPriority
  onChange: (next: TaskPriority) => void
}) {
  return (
    <Chip
      placeholder="Priority"
      icon={
        <span
          aria-hidden
          className={cn(
            "size-2.5 shrink-0 rounded-full",
            PRIORITY_DOTS[priority]
          )}
        />
      }
      label={TASK_PRIORITY_META[priority].label}
    >
      <div className="flex flex-col gap-0.5">
        {PRIORITY_ORDER.map((value) => (
          <ChipOption
            key={value}
            selected={value === priority}
            onSelect={() => onChange(value)}
            title={TASK_PRIORITY_META[value].label}
          >
            <span
              aria-hidden
              className={cn(
                "size-3.5 shrink-0 rounded-full",
                PRIORITY_DOTS[value]
              )}
            />
          </ChipOption>
        ))}
      </div>
    </Chip>
  )
}
