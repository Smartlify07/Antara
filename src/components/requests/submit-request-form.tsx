import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2Icon, PlusIcon } from "lucide-react"
import { useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
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
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import {
  submitRequestSchema,
  requestPrioritySchema,
} from "@/lib/request-schemas"
import { submitRequestFn } from "@/server/functions/requests"
import { navigateWithTransition } from "@/lib/navigate-with-transition"

/**
 * The intake form (FR-006/007). The server's `submitRequestSchema` stays the
 * single truth; this form schema only adds the one raw input the wire schema
 * shouldn't know about — links arrive as one-per-line text by nature of a
 * textarea, and get split clean on the way out.
 */
const submitRequestFormSchema = submitRequestSchema
  .omit({ referenceLinks: true })
  .extend({
    linksRaw: z.string().max(4096).optional(),
  })

type SubmitRequestFormInput = z.input<typeof submitRequestFormSchema>

export function SubmitRequestForm({
  workspaceId,
  workspaceSlug,
  children,
}: {
  workspaceId: string
  workspaceSlug: string
  children: React.ReactNode
}) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<SubmitRequestFormInput>({
    resolver: zodResolver(submitRequestFormSchema),
    defaultValues: {
      workspaceId,
      title: "",
      brief: "",
      category: undefined,
      priority: undefined,
      desiredDeadline: undefined,
      linksRaw: undefined,
    },
  })

  async function onSubmit(values: SubmitRequestFormInput) {
    setServerError(null)
    const links = (values.linksRaw ?? "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)

    if (links.length > 10) {
      form.setError("linksRaw", {
        message: "Ten links is plenty for a brief.",
      })
      return
    }

    try {
      const submitted = await submitRequestFn({
        data: {
          workspaceId,
          title: values.title,
          brief: values.brief,
          category: values.category || undefined,
          priority: values.priority,
          desiredDeadline: values.desiredDeadline || undefined,
          referenceLinks: links.length ? links : undefined,
        },
      })
      form.reset()
      setOpen(false)
      await navigateWithTransition(() =>
        navigate({
          to: "/w/$workspaceSlug/requests/$requestId",
          params: { workspaceSlug, requestId: submitted.id },
          replace: true,
        })
      )
    } catch (error) {
      setServerError(
        error instanceof Error ? error.message : "Could not submit the request."
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
          <DialogTitle>Submit a request</DialogTitle>
          <DialogDescription>
            What does this workspace need made? A lead will pick it up from
            here.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-2"
          noValidate
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="request-title">Title</FieldLabel>
              <Input
                id="request-title"
                placeholder="Teaser video for the spring drop"
                {...form.register("title")}
              />
              <FieldError errors={[form.formState.errors.title]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="request-brief">Brief</FieldLabel>
              <Textarea
                id="request-brief"
                rows={6}
                placeholder="What's the work, who is it for, and what does done look like?"
                {...form.register("brief")}
              />
              <FieldDescription>
                This is what the creative team reads first — rich briefs get
                triaged faster.
              </FieldDescription>
              <FieldError errors={[form.formState.errors.brief]} />
            </Field>

            <div className="grid gap-2 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="request-category">
                  Category{" "}
                  <span className="text-muted-foreground">(optional)</span>
                </FieldLabel>
                <Input
                  id="request-category"
                  placeholder="video, landing page, brand…"
                  {...form.register("category")}
                />
                <FieldError errors={[form.formState.errors.category]} />
              </Field>
              <Field>
                <FieldLabel htmlFor="request-priority">
                  Priority{" "}
                  <span className="text-muted-foreground">(optional)</span>
                </FieldLabel>
                <select
                  id="request-priority"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none"
                  {...form.register("priority")}
                  defaultValue=""
                >
                  <option value="">—</option>
                  {requestPrioritySchema.options.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority[0].toUpperCase() + priority.slice(1)}
                    </option>
                  ))}
                </select>
                <FieldError errors={[form.formState.errors.priority]} />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="request-deadline">
                Desired deadline{" "}
                <span className="text-muted-foreground">(optional)</span>
              </FieldLabel>
              <Input
                id="request-deadline"
                type="date"
                {...form.register("desiredDeadline")}
              />
              <FieldError errors={[form.formState.errors.desiredDeadline]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="request-links">
                Reference links{" "}
                <span className="text-muted-foreground">
                  (one per line, optional)
                </span>
              </FieldLabel>
              <Textarea
                id="request-links"
                rows={3}
                placeholder={
                  "https://mood.board/spring\nhttps://competitor.example/teaser"
                }
                {...form.register("linksRaw")}
              />
              <FieldError errors={[form.formState.errors.linksRaw]} />
            </Field>
          </FieldGroup>

          {serverError && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {serverError}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <Loader2Icon className="animate-spin" />
              ) : (
                <PlusIcon />
              )}
              Submit request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
