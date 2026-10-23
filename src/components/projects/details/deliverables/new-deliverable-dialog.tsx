import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2Icon, TagIcon } from "lucide-react"
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
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Chip, ChipOption } from "@/components/projects/chip"
import { DateChip } from "@/components/projects/dates-chip"
import { OwnerChip } from "@/components/projects/member-chip"
import { createDeliverableSchema } from "@/lib/deliverable-schemas"
import { createDeliverableFn } from "@/server/functions/deliverables"
import type { AssignableMember } from "@/server/services/project-service"

/**
 * The deliverable creation form (FR-013), laid out like the project create
 * form: a bare title, one row of detail pills (owner, deadline, type), then
 * the description. The wire schema is the single truth; the form only drops
 * the two path values it receives as props — owner, deadline and type are all
 * optional at creation, since triage may not yet have shaped the work.
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

  const watchedTitle = form.watch("title")
  const watchedOwnerId = form.watch("ownerId")
  const watchedDeadline = form.watch("deadline")
  const watchedType = form.watch("type")

  const selectedOwner =
    members.find((member) => member.teamId === watchedOwnerId) ?? null

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
          className="flex flex-col gap-4"
          noValidate
        >
          <input
            {...form.register("title")}
            placeholder="Deliverable title"
            aria-label="Deliverable title"
            maxLength={200}
            autoFocus
            className="w-full bg-transparent text-2xl font-medium tracking-tight outline-none placeholder:text-muted-foreground"
          />

          <div className="flex flex-wrap items-center gap-2">
            <OwnerChip
              members={members}
              owner={selectedOwner}
              onSelect={(teamId) =>
                form.setValue("ownerId", teamId ?? undefined)
              }
            />
            <DateChip
              deadline={watchedDeadline ?? null}
              onChange={(deadline) =>
                form.setValue("deadline", deadline ?? undefined)
              }
            />
            <TypeChip
              type={watchedType}
              onChange={(next) => form.setValue("type", next)}
            />
          </div>

          <div className="border-b" />

          <Textarea
            {...form.register("description")}
            placeholder="What this deliverable covers"
            aria-label="Deliverable description (optional)"
            maxLength={4000}
            className="min-h-[160px] w-full resize-none border-0 bg-transparent text-sm shadow-none focus-visible:ring-0"
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
              disabled={form.formState.isSubmitting || !watchedTitle.trim()}
            >
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

/** The suggestions the old field description offered, one click each. */
const SUGGESTED_TYPES = ["video", "graphics", "copy"]

/**
 * The free-form type as a house pill: suggestions one click each, a custom
 * entry for anything else. The draft resets by construction — the stateful
 * content mounts inside the popover and unmounts with it on close.
 */
function TypeChip({
  type,
  onChange,
}: {
  type: string | undefined
  onChange: (next: string | undefined) => void
}) {
  return (
    <Chip
      placeholder="Set type"
      icon={<TagIcon className="size-3.5 shrink-0" />}
      label={type}
    >
      <TypeChipContent type={type} onChange={onChange} />
    </Chip>
  )
}

function TypeChipContent({
  type,
  onChange,
}: {
  type: string | undefined
  onChange: (next: string | undefined) => void
}) {
  const [draft, setDraft] = useState("")

  function pick(next: string | undefined) {
    setDraft("")
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-1 p-1">
      <Input
        aria-label="Custom type"
        placeholder="Custom type…"
        value={draft}
        maxLength={80}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          // A here submit must stay inside the popover — the dialog's
          // form handler sits underneath it and would create the
          // deliverable underneath the picker.
          if (event.key !== "Enter") return
          event.preventDefault()
          if (draft.trim()) pick(draft.trim())
        }}
        className="bg-transparent text-sm"
      />
      <div className="flex flex-col gap-0.5">
        {SUGGESTED_TYPES.map((value) => (
          <ChipOption
            key={value}
            selected={type === value}
            onSelect={() => pick(type === value ? undefined : value)}
            title={value}
          />
        ))}
      </div>
      <p className="px-2 pb-1 text-[11px] text-muted-foreground">
        Free-form for now — the type taxonomy is still open.
      </p>
    </div>
  )
}
