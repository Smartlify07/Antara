import { Loader2Icon, PlusIcon } from "lucide-react"
import { useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
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
import {
  CategoryChip,
  DeadlineChip,
  PriorityChip,
  ReferenceLinksChip,
  toDateString,
} from "@/components/requests/request-form-chips"
import { requestCategoriesQuery } from "@/lib/queries/requests"
import { submitRequestFn } from "@/server/functions/requests"
import { navigateWithTransition } from "@/lib/navigate-with-transition"
import type { TaskPriority } from "@/db/enums"

/**
 * The intake form (FR-006/007), in the project-create-form style: a big
 * borderless title, a pill row for the metadata, and the brief at the bottom.
 * The server's `submitRequestSchema` stays the single truth — the only client
 * checks here are the two the schema names in its own copy, so the messages
 * never drift between layers.
 */
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
  const [title, setTitle] = useState("")
  const [brief, setBrief] = useState("")
  const [category, setCategory] = useState<string | null>(null)
  const [priority, setPriority] = useState<TaskPriority | null>(null)
  const [deadline, setDeadline] = useState<Date | null>(null)
  const [links, setLinks] = useState<string[]>([])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Suggestions only; suggestions meaningfully change while the dialog is
  // open, so the query follows its lifecycle instead of running always.
  const categories = useQuery({
    ...requestCategoriesQuery(workspaceId),
    enabled: open,
  })

  function resetForm() {
    setTitle("")
    setBrief("")
    setCategory(null)
    setPriority(null)
    setDeadline(null)
    setLinks([])
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (pending) return

    if (title.trim().length === 0) {
      setError("Give the request a title.")
      return
    }
    if (brief.trim().length < 20) {
      setError("Describe the work — at least a sentence or two.")
      return
    }

    setPending(true)
    setError(null)

    try {
      const submitted = await submitRequestFn({
        data: {
          workspaceId,
          title: title.trim(),
          brief: brief.trim(),
          category: category?.trim() || undefined,
          priority: priority ?? undefined,
          desiredDeadline: deadline ? toDateString(deadline) : undefined,
          referenceLinks: links.length ? links : undefined,
        },
      })
      resetForm()
      setOpen(false)
      await navigateWithTransition(() =>
        navigate({
          to: "/w/$workspaceSlug/requests/$requestId",
          params: { workspaceSlug, requestId: submitted.id },
          replace: true,
        })
      )
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not submit the request."
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setError(null)
        else setPending(false)
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        {/* The big title input below is the visible identity; the dialog
            header stays for Radix's labelled-dialog contract. */}
        <DialogHeader className="sr-only">
          <DialogTitle>Submit a request</DialogTitle>
          <DialogDescription>
            What does this workspace need made? A lead will pick it up from
            here.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4"
          noValidate
        >
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Request title"
            aria-label="Request title"
            maxLength={200}
            autoFocus
            className="w-full bg-transparent text-2xl font-medium tracking-tight outline-none placeholder:text-muted-foreground"
          />

          <div className="flex flex-wrap items-center gap-2">
            <CategoryChip
              options={categories.data ?? []}
              value={category}
              onChange={setCategory}
            />
            <PriorityChip value={priority} onChange={setPriority} />
            <DeadlineChip deadline={deadline} onChange={setDeadline} />
            <ReferenceLinksChip links={links} onChange={setLinks} />
          </div>

          <div className="border-b" />

          <Textarea
            value={brief}
            onChange={(event) => setBrief(event.target.value)}
            placeholder="What's the work, who is it for, and what does done look like?"
            aria-label="Request brief"
            maxLength={20000}
            className="min-h-[200px] w-full resize-none border-0 bg-transparent text-sm shadow-none focus-visible:ring-0"
          />

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pending || title.trim().length === 0}
            >
              {pending ? (
                <Loader2Icon className="animate-spin" />
              ) : (
                <PlusIcon />
              )}
              {pending ? "Submitting…" : "Submit request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
