import { Loader2Icon } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createTaskFn } from "@/server/functions/tasks"
import type { AssignableMember } from "@/server/services/project-service"

/**
 * The inline "add a task" composer (FR-016): one input for the title, a
 *due-date and assignee picker that stay collapsed until expanded. Deliverables
 * embed it under their card; the loose-tasks bucket reuses the same atom.
 */
export function TaskComposer({
  workspaceId,
  projectId,
  deliverableId,
  members,
  onCreated,
}: {
  workspaceId: string
  projectId: string
  deliverableId?: string
  /** Project members (the only people a task may be assigned to). */
  members: AssignableMember[]
  onCreated: () => void
}) {
  const [title, setTitle] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [assignee, setAssignee] = useState("")
  const [expand, setExpand] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    const trimmed = title.trim()
    if (!trimmed) {
      setError("Name the task.")
      return
    }
    setError(null)
    setPending(true)
    try {
      await createTaskFn({
        data: {
          workspaceId,
          projectId,
          deliverableId: deliverableId ?? null,
          title: trimmed,
          dueDate: dueDate || undefined,
          assigneeTeamIds: assignee ? [assignee] : undefined,
          // Create flow deliberately owns the shape at default values.
          priority: undefined,
        },
      })
      setTitle("")
      setDueDate("")
      setAssignee("")
      setExpand(false)
      onCreated()
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not add the task."
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Add a task…"
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault()
              void submit()
            }
          }}
          onFocus={() => setExpand(true)}
          className="h-8 bg-background text-sm"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 shrink-0"
          onClick={() => void submit()}
          disabled={pending}
        >
          {pending ? <Loader2Icon className="size-3.5 animate-spin" /> : "Add"}
        </Button>
      </div>

      {expand && (
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            aria-label="Due date"
            className="h-8 bg-background text-xs"
          />
          <select
            value={assignee}
            onChange={(event) => setAssignee(event.target.value)}
            aria-label="Assignee"
            className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-xs outline-none"
          >
            <option value="">Unassigned</option>
            {members.map((member) => (
              <option key={member.teamId} value={member.teamId}>
                {member.name ?? member.email ?? "Member"}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
