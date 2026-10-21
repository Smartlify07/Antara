import { zodResolver } from "@hookform/resolvers/zod"
import { CalendarDaysIcon, Loader2Icon } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import type { z } from "zod"
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
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { formatDueDate, fromIsoDay, toIsoDay } from "@/lib/time"
import { cn } from "@/lib/utils"
import { createDeliverableSchema } from "@/lib/deliverable-schemas"
import { createDeliverableFn } from "@/server/functions/deliverables"
import type { AssignableMember } from "@/server/services/project-service"

/**
 * The deliverable creation form (FR-013). The wire schema is the single
 * truth; the form only drops the two path values it receives as props —
 * owner, deadline and type are all optional at creation, since triage may
 * not yet have shaped the work.
 */
const newDeliverableFormSchema = createDeliverableSchema.omit({
  workspaceId: true,
  projectId: true,
})

type NewDeliverableFormInput = z.input<typeof newDeliverableFormSchema>

export function NewDeliverableDialog({
  workspaceId,
  projectId,
  members,
  children,
  onCreated,
}: {
  workspaceId: string
  projectId: string
  /** Project members with a workspace row (the only assignable people). */
  members: AssignableMember[]
  children: React.ReactNode
  onCreated: () => void
}) {
  const [open, setOpen] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<NewDeliverableFormInput>({
    resolver: zodResolver(newDeliverableFormSchema),
    defaultValues: {
      title: "",
      description: undefined,
      type: undefined,
      ownerId: undefined,
      deadline: undefined,
    },
  })

  // The deadline rides the calendar popover: the control writes straight
  // into the form's value, and the label reads what it holds.
  const watchedDeadline = form.watch("deadline")

  async function onSubmit(values: NewDeliverableFormInput) {
    setServerError(null)
    try {
      await createDeliverableFn({
        data: {
          workspaceId,
          projectId,
          title: values.title,
          description: values.description || undefined,
          type: values.type || undefined,
          ownerId: values.ownerId || undefined,
          deadline: values.deadline || undefined,
        },
      })
      form.reset()
      setOpen(false)
      onCreated()
    } catch (error) {
      setServerError(
        error instanceof Error
          ? error.message
          : "Could not create the deliverable."
      )
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setServerError(null)
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>New deliverable</DialogTitle>
          <DialogDescription>
            A piece of this project's work, with its own owner, deadline and
            production state.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-2"
          noValidate
        >
          <Field>
            <FieldLabel htmlFor="deliverable-title">Title</FieldLabel>
            <Input
              id="deliverable-title"
              placeholder="e.g. 60-second launch film"
              {...form.register("title")}
            />
            <FieldError errors={[form.formState.errors.title]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="deliverable-description">
              Description{" "}
              <span className="text-muted-foreground">(optional)</span>
            </FieldLabel>
            <Textarea
              id="deliverable-description"
              rows={3}
              placeholder="What this deliverable covers"
              {...form.register("description")}
            />
            <FieldError errors={[form.formState.errors.description]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="deliverable-type">
              Type <span className="text-muted-foreground">(optional)</span>
            </FieldLabel>
            <FieldDescription>
              e.g. video, graphics, copy — free-form for now
            </FieldDescription>
            <Input
              id="deliverable-type"
              placeholder="video"
              {...form.register("type")}
            />
          </Field>

          <div className="grid gap-2 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="deliverable-owner">
                Owner <span className="text-muted-foreground">(optional)</span>
              </FieldLabel>
              <select
                id="deliverable-owner"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none"
                {...form.register("ownerId")}
                defaultValue=""
              >
                <option value="">Unassigned</option>
                {members.map((member) => (
                  <option key={member.teamId} value={member.teamId}>
                    {member.name ?? member.email ?? "Member"}
                  </option>
                ))}
              </select>
            </Field>

            <Field>
              <FieldLabel>
                Deadline{" "}
                <span className="text-muted-foreground">(optional)</span>
              </FieldLabel>
              {/* The house calendar (dates-chip.tsx's idiom), not an OS date
                  input: the picked day is the stored day, no UTC shift. */}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex h-9 w-full items-center gap-2 rounded-md border border-input bg-background px-3 py-1 text-left text-sm shadow-xs outline-none"
                  >
                    <CalendarDaysIcon className="size-4 shrink-0 text-muted-foreground" />
                    <span
                      className={cn(
                        !watchedDeadline && "text-muted-foreground"
                      )}
                    >
                      {watchedDeadline
                        ? formatDueDate(fromIsoDay(watchedDeadline))
                        : "Pick a deadline"}
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-1">
                  <Calendar
                    mode="single"
                    selected={
                      watchedDeadline ? fromIsoDay(watchedDeadline) : undefined
                    }
                    onSelect={(next) =>
                      form.setValue(
                        "deadline",
                        next ? toIsoDay(next) : undefined
                      )
                    }
                  />
                  <div className="flex items-center justify-between gap-2 px-1 pt-1 text-[11px] text-muted-foreground">
                    <span>
                      {watchedDeadline
                        ? "Pick another day to change"
                        : "Pick a day"}
                    </span>
                    {watchedDeadline && (
                      <button
                        type="button"
                        className="underline underline-offset-2 hover:text-foreground"
                        onClick={() => form.setValue("deadline", undefined)}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
              <FieldError errors={[form.formState.errors.deadline]} />
            </Field>
          </div>

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
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" />
                  Creating…
                </>
              ) : (
                "Create deliverable"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
