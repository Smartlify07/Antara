import { Link } from "@tanstack/react-router"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CalendarClockIcon, ChevronDownIcon, MoreHorizontalIcon, UsersIcon } from "lucide-react"
import { useState } from "react"
import { formatDueDate } from "@/lib/time"
import {
  setDeliverableDeadlineFn,
  setDeliverableOwnerFn,
  setDeliverableStatusFn,
} from "@/server/functions/deliverables"
import type { AssignableMember } from "@/server/services/project-service"
import type { DeliverableCard } from "@/server/services/deliverable-service"
import type { TaskCard } from "@/server/services/task-service"
import { TaskComposer } from "./task-composer"
import { TaskRow } from "./task-row"
import {
  DELIVERABLE_META,
  deliverableMoveTargets,
} from "./deliverable-meta"

/**
 * One deliverable card (FR-013..017): owner, deadline, production state, and
 * its tasks. The owner chip and the deadline text are the edit affordances
 * themselves for admins/leads — no separate edit screen, the card is the
 * surface. The production chip offers exactly the machine's targets from its
 * current state; `completed` is terminal, so its chip stops offering.
 */
export function DeliverableCard({
  workspaceSlug,
  workspaceId,
  projectId,
  deliverable,
  tasks,
  members,
  onChanged,
  canWork,
}: {
  workspaceSlug: string
  workspaceId: string
  projectId: string
  deliverable: DeliverableCard
  /** This deliverable's tasks, already filtered by the panel. */
  tasks: TaskCard[]
  /** Project members — the pool owners may be drawn from. */
  members: AssignableMember[]
  onChanged: () => void
  canWork: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ownerOpen, setOwnerOpen] = useState(false)
  const [deadlineOpen, setDeadlineOpen] = useState(false)

  const meta = DELIVERABLE_META[deliverable.status]
  const targets = deliverableMoveTargets(deliverable.status)

  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    setError(null)
    try {
      await action()
      onChanged()
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "That change did not land."
      )
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start gap-2">
        {targets.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                disabled={busy || !deliverable.viewerCanMove}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${meta.badgeClass} ${
                  deliverable.viewerCanMove ? "hover:opacity-80" : "opacity-80"
                }`}
                aria-label={`Production status: ${meta.label}. ${
                  deliverable.viewerCanMove ? "Change status." : undefined
                }`}
              >
                {meta.label}
                {deliverable.viewerCanMove && (
                  <ChevronDownIcon className="size-3 opacity-70" />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-44">
              {targets.map((target) => (
                <DropdownMenuItem
                  key={target}
                  onClick={() =>
                    void run(() =>
                      setDeliverableStatusFn({
                        data: {
                          workspaceId,
                          projectId,
                          deliverableId: deliverable.id,
                          status: target,
                        },
                      })
                    )
                  }
                >
                  Move to {DELIVERABLE_META[target].label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${meta.badgeClass}`}
          >
            {meta.label}
          </span>
        )}

        <h3 className="text-sm font-semibold tracking-tight">
          {deliverable.title}
        </h3>

        {deliverable.viewerCanManage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Deliverable options"
                className="ml-auto rounded-md p-1 text-muted-foreground hover:bg-muted"
                disabled={busy}
              >
                <MoreHorizontalIcon className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setOwnerOpen(true)}>
                Change owner…
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDeadlineOpen(true)}>
                Set deadline…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {deliverable.description && (
        <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
          {deliverable.description}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          {deliverable.owner ? (
            <>
              <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[10px] font-medium">
                {(deliverable.owner.name?.trim()[0] ?? "?").toUpperCase()}
              </span>
              {deliverable.owner.name ?? deliverable.owner.email ?? "Owner"}
            </>
          ) : (
            <>
              <UsersIcon aria-hidden className="size-3.5" />
              Unowned
            </>
          )}
        </span>

        {deliverable.deadline && (
          <span
            className={
              deliverable.overdue
                ? "inline-flex items-center gap-1 font-medium text-destructive"
                : "inline-flex items-center gap-1"
            }
          >
            <CalendarClockIcon aria-hidden className="size-3.5" />
            {deliverable.overdue ? "Overdue · " : ""}
            {formatDueDate(deliverable.deadline)}
          </span>
        )}

        {deliverable.type && <span>{deliverable.type}</span>}

        {deliverable.request && (
          <Link
            to="/w/$workspaceSlug/requests/$requestId"
            params={{ workspaceSlug, requestId: deliverable.request.id }}
            className="inline-flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 hover:underline"
          >
            from request
          </Link>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      )}

      <div className="mt-3 flex flex-col gap-1.5">
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            workspaceSlug={workspaceSlug}
            workspaceId={workspaceId}
            task={task}
            canWork={canWork}
            onChanged={onChanged}
          />
        ))}
        {canWork && (
          <TaskComposer
            workspaceId={workspaceId}
            projectId={projectId}
            deliverableId={deliverable.id}
            members={members}
            onCreated={onChanged}
          />
        )}
      </div>

      {/* Owner picker */}
      <Dialog open={ownerOpen} onOpenChange={setOwnerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change owner</DialogTitle>
            <DialogDescription>
              Owners are workspace members; the person carrying this
              deadline can move its production status.
            </DialogDescription>
          </DialogHeader>
          <div className="grid max-h-72 gap-1 overflow-y-auto">
            <button
              type="button"
              onClick={() =>
                void run(() =>
                  setDeliverableOwnerFn({
                    data: {
                      workspaceId,
                      projectId,
                      deliverableId: deliverable.id,
                      ownerId: null,
                    },
                  })
                ).then(() => setOwnerOpen(false))
              }
              className="rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
            >
              Unassign owner
            </button>
            {members.map((member) => (
              <button
                key={member.teamId}
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(() =>
                    setDeliverableOwnerFn({
                      data: {
                        workspaceId,
                        projectId,
                        deliverableId: deliverable.id,
                        ownerId: member.teamId,
                      },
                    })
                  ).then(() => setOwnerOpen(false))
                }
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
              >
                <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                  {(member.name?.trim()[0] ?? "?").toUpperCase()}
                </span>
                {member.name ?? member.email ?? "Member"}
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOwnerOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deadline picker — keyed so opening it always reads fresh state. */}
      <DeadlineDialog
        key={deliverable.deadline ?? "none"}
        open={deadlineOpen}
        onClose={() => setDeadlineOpen(false)}
        current={deliverable.deadline}
        busy={busy}
        onSet={(deadline) =>
          run(() =>
            setDeliverableDeadlineFn({
              data: {
                workspaceId,
                projectId,
                deliverableId: deliverable.id,
                deadline,
              },
            })
          ).then(() => setDeadlineOpen(false))
        }
      />
    </div>
  )
}

function DeadlineDialog({
  open,
  onClose,
  current,
  busy,
  onSet,
}: {
  open: boolean
  onClose: () => void
  current: string | null
  busy: boolean
  onSet: (deadline: string | null) => void | Promise<void>
}) {
  const [value, setValue] = useState(current ?? "")

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Set deadline</DialogTitle>
          <DialogDescription>
            Past-due deliverables that are not completed show as overdue.
          </DialogDescription>
        </DialogHeader>
        <Input
          type="date"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-label="Deadline"
        />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={busy}
            onClick={() => void onSet(value ? value : null)}
          >
            Save deadline
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
