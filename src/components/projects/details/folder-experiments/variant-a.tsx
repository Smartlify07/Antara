/**
 * Variant A of the folder-cutout concept sprint: "folder tab + stage".
 *
 * The cutout is a die-cut folder tab hanging flush under a quiet work-area
 * band; pulling it (hover nudges it down, click opens) shows the dialog,
 * which stages exactly one deliverable at a time — its header, a version
 * filmstrip, and one continuous thread (tasks first, then the conversation)
 * on a shared hairline spine. Clicking a filmstrip chip swaps the stage to
 * that version in place with a crossfade; the breadcrumb back is the only
 * navigation. Everything is local state over `mock.ts`, so the concept
 * renders instantly and exists to answer one question: does a folder tab
 * feel better than the flat lanes?
 *
 * House bans honoured in this file — separation comes from the one permitted
 * background-painted spine (`w-px bg-border`), washes, spacing and text tone;
 * never `border-*`/`divide-*`/`ring-*`, and no spinners because nothing loads.
 */
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import {
  CalendarIcon,
  ChevronLeftIcon,
  FolderIcon,
  FolderOpenIcon,
} from "lucide-react"
import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatRelativeTime } from "@/lib/time"
import { cn } from "@/lib/utils"
import {
  DELIVERABLE_DOTS,
  MOCK_DELIVERABLES,
  MOCK_PROJECT,
  MOCK_VIEWER,
  PRIORITY_LABELS,
  REVIEW_DOTS,
  TASK_DOTS,
  formatDueDate,
  initialsOf,
  tintOf,
} from "./mock"
import type {
  MockComment,
  MockDeliverable,
  MockMember,
  MockTask,
  MockVersion,
} from "./mock"

/** The stage shows either the deliverable's thread, or one drilled-in version. */
type StageView = { kind: "thread" } | { kind: "version"; versionId: string }

/**
 * Comments composed locally, by thread scope — `d:<deliverableId>` for the
 * deliverable's thread, `v:<versionId>` for a version's feedback. Values may
 * be absent (nothing appended yet), so every read guard does real work.
 */
type DraftThreads = { [scope: string]: MockComment[] | undefined }

/**
 * Open work on a deliverable: live tasks (anything not done/approved) plus
 * draft versions never sent for review. The folder tab's count and the rail
 * rows both call this, so every surface tells the same story.
 */
function openWorkOf(deliverable: MockDeliverable): number {
  const openTasks = deliverable.tasks.filter(
    (task) => task.status !== "done" && task.status !== "approved"
  ).length
  const drafts = deliverable.versions.filter(
    (version) => version.reviewStatus === null
  ).length
  return openTasks + drafts
}

/** Static mock — the folder tab's count is a constant, not per-render work. */
const OPEN_WORK_TOTAL = MOCK_DELIVERABLES.reduce(
  (sum, deliverable) => sum + openWorkOf(deliverable),
  0
)

/**
 * The named status dot: a filled circle whose colour comes from the mock's
 * dot maps, always paired with a plain text label — colour carries nothing
 * on its own.
 */
function Dot({ dot, className }: { dot: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("size-3 shrink-0 rounded-full", dot, className)}
    />
  )
}

/** Initials face with the house tint pool — cheap, stable ownership. */
function PersonAvatar({
  person,
  className,
}: {
  person: MockMember
  className: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-medium",
        tintOf(person),
        className
      )}
    >
      {initialsOf(person.name)}
    </span>
  )
}

/**
 * The shared left spine of the thread: the single hairline the brief
 * permits, painted as a background rail inside the indent. Segment lengths
 * differ per node so the line can start at the first face and stop at the
 * composer instead of running off the end of the conversation.
 */
function Spine({ className }: { className: string }) {
  return (
    <div aria-hidden className="relative w-7 shrink-0">
      <span className={cn("absolute left-3 w-px bg-border", className)} />
    </div>
  )
}

/**
 * One task hanging off the spine: tinted faces, title, then a quiet meta
 * line — status dot + label, priority as plain text when it rises above
 * medium, due date red when overdue. Settled tasks read in a retired tone.
 */
function TaskNode({ task }: { task: MockTask }) {
  const meta = TASK_DOTS[task.status]
  const settled = task.status === "done" || task.status === "approved"

  return (
    <div className="flex">
      <Spine className="inset-y-0" />
      <div className="min-w-0 flex-1 pb-5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {task.assignees.length > 0 && (
            <span className="flex -space-x-1.5">
              {task.assignees.map((assignee) => (
                <PersonAvatar
                  key={assignee.teamId}
                  person={assignee}
                  className="size-5 text-[10px]"
                />
              ))}
            </span>
          )}
          <span
            className={cn(
              "min-w-0 text-sm",
              settled ? "text-muted-foreground/60" : "font-medium"
            )}
          >
            {task.title}
          </span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 pl-7 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Dot dot={meta.dot} />
            {meta.label}
          </span>
          {task.priority !== "medium" && (
            <span>{PRIORITY_LABELS[task.priority]}</span>
          )}
          {task.dueDate && (
            <span
              className={
                task.overdue ? "font-medium text-destructive" : undefined
              }
            >
              {task.overdue ? "Overdue · " : "due "}
              {formatDueDate(task.dueDate)}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

/** The comment half of the thread language: face, name · time, body. */
function CommentNode({ comment }: { comment: MockComment }) {
  return (
    <div className="flex">
      <Spine className="inset-y-0" />
      <div className="min-w-0 flex-1 pb-5">
        <div className="flex items-center gap-2">
          <PersonAvatar
            person={comment.author}
            className="size-5 text-[10px]"
          />
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              {comment.author.name}
            </span>
            <span aria-hidden> · </span>
            {formatRelativeTime(comment.createdAt)}
          </p>
        </div>
        <p className="mt-0.5 pl-7 text-sm break-words whitespace-pre-wrap text-foreground/90">
          {comment.body}
        </p>
      </div>
    </div>
  )
}

/**
 * The borderless composer line at a thread's end. Enter appends to the local
 * copy of the thread — mock-only, the entry appears instantly and dies with
 * the concept. Focus reads through a wash on the line, not a ring.
 */
function ComposerLine({ onAppend }: { onAppend: (body: string) => void }) {
  const [body, setBody] = useState("")

  return (
    <form
      className="flex"
      onSubmit={(event) => {
        event.preventDefault()
        const trimmed = body.trim()
        if (!trimmed) return
        onAppend(trimmed)
        setBody("")
      }}
    >
      <Spine className="top-0 h-4" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 rounded-md py-1 transition-colors focus-within:bg-muted/40 hover:bg-muted/40">
          <PersonAvatar person={MOCK_VIEWER} className="size-5 text-[10px]" />
          <input
            aria-label="Leave a comment"
            placeholder="Leave a comment…"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className="min-w-0 flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground/60"
          />
        </div>
      </div>
    </form>
  )
}

/**
 * The comments-only switch, built as the house sliding pill: a muted track
 * with one bg-background thumb that slides to whichever half is active. The
 * halves are equal width, so the thumb's position is arithmetic like
 * TabsSwitcher; it sits still on first paint instead of sliding in.
 */
function CommentsOnlyToggle({
  commentsOnly,
  onChange,
}: {
  commentsOnly: boolean
  onChange: (next: boolean) => void
}) {
  const [animated, setAnimated] = useState(false)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setAnimated(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  const options = [
    { label: "All", value: false },
    { label: "Comments only", value: true },
  ]

  return (
    <div
      role="group"
      aria-label="Thread filter"
      className="relative flex shrink-0 items-center rounded-lg bg-muted/60 p-0.5"
    >
      <span
        aria-hidden
        className={cn(
          "absolute top-0.5 bottom-0.5 left-0.5 w-[calc(50%-0.125rem)] rounded-md bg-background shadow-sm",
          animated && "transition-transform duration-200 ease-out"
        )}
        style={{ transform: `translateX(${commentsOnly ? 100 : 0}%)` }}
      />
      {options.map((option) => (
        <button
          key={option.value ? "comments-only" : "all"}
          type="button"
          aria-pressed={option.value === commentsOnly}
          onClick={() => onChange(option.value)}
          className={cn(
            "relative z-1 w-[5.5rem] rounded-md px-1 py-1 text-center text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring",
            option.value === commentsOnly
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/**
 * The thread stage: deliverable header, then the version filmstrip and the
 * comments-only switch on one row, then the conversation scrolling itself.
 */
function ThreadStage({
  deliverable,
  commentsOnly,
  onToggleCommentsOnly,
  drafts,
  onAppend,
  onOpenVersion,
}: {
  deliverable: MockDeliverable
  commentsOnly: boolean
  onToggleCommentsOnly: (next: boolean) => void
  drafts: DraftThreads
  onAppend: (scope: string, body: string) => void
  onOpenVersion: (versionId: string) => void
}) {
  const scope = `d:${deliverable.id}`
  const comments = [...deliverable.comments, ...(drafts[scope] ?? [])]

  return (
    <>
      <div className="shrink-0 px-6 pt-5">
        <h2 className="truncate pr-9 text-lg font-semibold tracking-tight">
          {deliverable.title}
        </h2>

        {/* Plain-text meta: status dot + label, owner face + name, due date. */}
        <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Dot dot={DELIVERABLE_DOTS[deliverable.status].dot} />
            {DELIVERABLE_DOTS[deliverable.status].label}
          </span>
          <span aria-hidden>·</span>
          {deliverable.owner ? (
            <span className="flex items-center gap-1.5">
              <PersonAvatar
                person={deliverable.owner}
                className="size-4 text-[9px]"
              />
              {deliverable.owner.name}
            </span>
          ) : (
            <span>Unassigned</span>
          )}
          {deliverable.deadline && (
            <>
              <span aria-hidden>·</span>
              <span
                className={cn(
                  "flex items-center gap-1",
                  deliverable.overdue && "font-medium text-destructive"
                )}
              >
                <CalendarIcon aria-hidden className="size-3" />
                {deliverable.overdue ? "Overdue · " : "due "}
                {formatDueDate(deliverable.deadline)}
              </span>
            </>
          )}
        </div>

        {deliverable.description && (
          <p className="mt-2 text-sm text-muted-foreground">
            {deliverable.description}
          </p>
        )}

        {/* The filmstrip and the filter share the header's last row; the chips
            scroll if crowded. Typographic emphasis only — no chip boxes. */}
        <div className="mt-4 flex items-center gap-3">
          {deliverable.versions.length > 0 && (
            <div className="flex min-w-0 flex-1 items-center gap-2.5 overflow-x-auto">
              {deliverable.versions.map((version) => {
                const review = version.reviewStatus
                  ? REVIEW_DOTS[version.reviewStatus]
                  : null
                return (
                  <button
                    key={version.id}
                    type="button"
                    aria-label={`Open version ${version.label}`}
                    onClick={() => onOpenVersion(version.id)}
                    className={cn(
                      "-mx-1 flex shrink-0 items-center gap-1.5 rounded-md px-1 font-mono text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring",
                      version.isLatest
                        ? "font-medium text-foreground"
                        : "text-muted-foreground/60 hover:text-muted-foreground"
                    )}
                  >
                    {version.label}
                    {review && <Dot dot={review.dot} />}
                  </button>
                )
              })}
            </div>
          )}
          <CommentsOnlyToggle
            commentsOnly={commentsOnly}
            onChange={onToggleCommentsOnly}
          />
        </div>
      </div>

      {/* The thread scrolls itself; the dialog body never does. Tasks sit
          first, then the conversation, one continuous spine throughout. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-4 pb-5">
        <AnimatePresence initial={false}>
          {!commentsOnly && (
            <motion.div
              key="tasks"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="overflow-hidden"
            >
              {deliverable.tasks.map((task) => (
                <TaskNode key={task.id} task={task} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {commentsOnly && comments.length === 0 ? (
          <div className="flex">
            <Spine className="inset-y-0" />
            <p className="min-w-0 flex-1 pb-5 text-sm text-muted-foreground">
              No comments yet — tasks are hidden in this view.
            </p>
          </div>
        ) : null}

        {comments.map((comment) => (
          <CommentNode key={comment.id} comment={comment} />
        ))}

        <ComposerLine onAppend={(body) => onAppend(scope, body)} />
      </div>
    </>
  )
}

/**
 * The version stage: breadcrumb back, version identity, submitter notes as a
 * quoted muted block, the recorded decision when one exists, then the
 * version's feedback in the same thread language with its own composer.
 */
function VersionStage({
  deliverable,
  version,
  drafts,
  onAppend,
  onBack,
}: {
  deliverable: MockDeliverable
  version: MockVersion
  drafts: DraftThreads
  onAppend: (scope: string, body: string) => void
  onBack: () => void
}) {
  const scope = `v:${version.id}`
  const feedback = [...version.feedback, ...(drafts[scope] ?? [])]

  return (
    <>
      <div className="shrink-0 px-6 pt-5">
        <button
          type="button"
          onClick={onBack}
          className="-ml-1 flex items-center gap-0.5 rounded-md py-0.5 pr-2 pl-1 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring"
        >
          <ChevronLeftIcon aria-hidden className="size-3.5" />
          {deliverable.title} thread
        </button>

        <h2 className="mt-2 truncate pr-9 text-lg font-semibold tracking-tight">
          {version.label} — {version.assetLabel}
        </h2>

        <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
          <span>{version.sourceLabel}</span>
          <span aria-hidden>·</span>
          <span>
            Submitted by {version.submitter.name ?? "a former member"} ·{" "}
            {formatRelativeTime(version.createdAt)}
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-4 pb-5">
        {version.submitterNotes && (
          <blockquote className="rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground italic">
            “{version.submitterNotes}”
          </blockquote>
        )}

        {version.decision && (
          <div className="mt-3 flex flex-col items-start gap-1">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Dot dot={REVIEW_DOTS[version.decision.kind].dot} />
              {REVIEW_DOTS[version.decision.kind].label} by{" "}
              {version.decision.by ?? "a former member"} ·{" "}
              {formatRelativeTime(version.decision.at)}
            </p>
            {version.decision.note && (
              <p className="text-xs text-muted-foreground">
                {version.decision.note}
              </p>
            )}
          </div>
        )}

        <div className="mt-4">
          {feedback.length === 0 ? (
            <div className="flex">
              <Spine className="inset-y-0" />
              <p className="min-w-0 flex-1 pb-5 text-sm text-muted-foreground">
                No feedback on this version yet.
              </p>
            </div>
          ) : (
            feedback.map((comment) => (
              <CommentNode key={comment.id} comment={comment} />
            ))
          )}
          <ComposerLine onAppend={(body) => onAppend(scope, body)} />
        </div>
      </div>
    </>
  )
}

/**
 * Variant A: the folder element (band + die-cut tab) and the dialog it owns.
 */
export function DeliverablesFolderA() {
  const [open, setOpen] = useState(false)
  const [activeId, setActiveId] = useState(MOCK_DELIVERABLES[0]?.id ?? "")
  const [view, setView] = useState<StageView>({ kind: "thread" })
  const [commentsOnly, setCommentsOnly] = useState(false)
  const [drafts, setDrafts] = useState<DraftThreads>({})
  const reducedMotion = useReducedMotion()

  /** The tab's pull: 6px down on hover and while open, still if reduced. */
  const lift = reducedMotion ? 0 : 6

  const deliverable = MOCK_DELIVERABLES.find(
    (candidate) => candidate.id === activeId
  )
  const activeVersion =
    deliverable && view.kind === "version"
      ? deliverable.versions.find(
          (candidate) => candidate.id === view.versionId
        )
      : undefined

  /** Enter appends to the local copy of the thread; nowhere is a server. */
  function appendDraft(scope: string, body: string) {
    setDrafts((current) => ({
      ...current,
      [scope]: [
        ...(current[scope] ?? []),
        {
          id: `local-${scope}-${current[scope]?.length ?? 0}`,
          author: MOCK_VIEWER,
          createdAt: new Date(),
          body,
        },
      ],
    }))
  }

  return (
    <div className="w-full">
      {/* The mock work-area band — quiet on purpose. The tab hangs flush
          under its bottom edge, no gap between them. */}
      <div className="rounded-lg bg-muted/40 px-6 pt-5 pb-9">
        <p className="text-[11px] text-muted-foreground/60">
          Project work area
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {MOCK_PROJECT.title}
        </p>
        <div aria-hidden className="mt-3 flex items-center gap-1.5">
          {MOCK_DELIVERABLES.map((row) => (
            <Dot key={row.id} dot={DELIVERABLE_DOTS[row.status].dot} />
          ))}
        </div>
      </div>

      {/* The die-cut tab. The silhouette is an actual clip-path (widest at
          the band edge, sloped shoulders, vertical sides); the shadow is a
          drop-shadow because clip-path clips a box shadow entirely, while a
          drop-shadow follows the cut. Whole-tab tone change is the visible
          focus state, since a focus ring outside the shape would be clipped. */}
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        initial={false}
        animate={{ y: open ? lift : 0 }}
        whileHover={{ y: lift }}
        whileTap={{ y: lift ? lift + 3 : 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className={cn(
          "relative -mt-px ml-7 h-11 w-52 cursor-pointer bg-background",
          "drop-shadow-2xs hover:drop-shadow-sm focus-visible:bg-muted focus-visible:drop-shadow-sm focus-visible:outline-none",
          "[clip-path:polygon(0%_0%,100%_0%,84%_30%,84%_100%,16%_100%,16%_30%)]"
        )}
      >
        {/* The folder face, two-tone over the lighter under-layer lip. */}
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-[58%] bg-muted"
        />
        <span className="relative z-1 flex w-full items-center gap-2 pr-[17%] pl-[17%]">
          {open ? (
            <FolderOpenIcon
              aria-hidden
              className="size-4 shrink-0 text-muted-foreground"
            />
          ) : (
            <FolderIcon
              aria-hidden
              className="size-4 shrink-0 text-muted-foreground"
            />
          )}
          <span className="text-sm font-medium text-foreground">
            Work files
          </span>
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            {OPEN_WORK_TOTAL} open
          </span>
        </span>
      </motion.button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[85vh] w-full max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl lg:max-w-4xl">
          <DialogTitle className="sr-only">Work files</DialogTitle>
          <DialogDescription className="sr-only">
            One deliverable at a time — its versions and the conversation around
            them.
          </DialogDescription>

          <div className="flex min-h-0 flex-1 overflow-hidden">
            <nav
              aria-label="Deliverables"
              className="flex w-60 shrink-0 flex-col bg-muted/20"
            >
              <div className="px-4 pt-4 pb-3">
                <p className="text-xs font-medium text-foreground">
                  {MOCK_PROJECT.title}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {MOCK_DELIVERABLES.length} deliverables · {OPEN_WORK_TOTAL}{" "}
                  open
                </p>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
                {MOCK_DELIVERABLES.map((row) => {
                  const active = row.id === deliverable?.id
                  const openWork = openWorkOf(row)
                  return (
                    <button
                      key={row.id}
                      type="button"
                      aria-current={active ? "true" : undefined}
                      onClick={() => {
                        setActiveId(row.id)
                        setView({ kind: "thread" })
                      }}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring",
                        active ? "bg-muted/40" : "hover:bg-muted/25"
                      )}
                    >
                      <Dot dot={DELIVERABLE_DOTS[row.status].dot} />
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate",
                          active
                            ? "font-medium text-foreground"
                            : "text-foreground/90"
                        )}
                      >
                        {row.title}
                      </span>
                      {openWork > 0 && (
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                          {openWork}
                        </span>
                      )}
                      {row.owner && (
                        <PersonAvatar
                          person={row.owner}
                          className="size-5 text-[10px]"
                        />
                      )}
                    </button>
                  )
                })}
              </div>
            </nav>

            {/* One grid cell shared by both stages: the swap is an in-place
                crossfade, and the cell keeps its height stable while both
                fade halves are mounted. */}
            <div className="grid min-w-0 flex-1">
              <AnimatePresence initial={false}>
                {deliverable && (
                  <motion.div
                    key={
                      activeVersion
                        ? `v:${activeVersion.id}`
                        : `d:${deliverable.id}`
                    }
                    initial={{ opacity: 0 }}
                    animate={{
                      opacity: 1,
                      transition: { duration: 0.2, ease: "easeOut" },
                    }}
                    exit={{
                      opacity: 0,
                      transition: { duration: 0.12, ease: "easeIn" },
                    }}
                    className="col-start-1 row-start-1 flex min-h-0 flex-col"
                  >
                    {activeVersion ? (
                      <VersionStage
                        deliverable={deliverable}
                        version={activeVersion}
                        drafts={drafts}
                        onAppend={appendDraft}
                        onBack={() => setView({ kind: "thread" })}
                      />
                    ) : (
                      <ThreadStage
                        deliverable={deliverable}
                        commentsOnly={commentsOnly}
                        drafts={drafts}
                        onToggleCommentsOnly={setCommentsOnly}
                        onAppend={appendDraft}
                        onOpenVersion={(versionId) =>
                          setView({ kind: "version", versionId })
                        }
                      />
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
