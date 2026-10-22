import { useEffect, useId, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import type { Transition, Variants } from "framer-motion"
import { FolderIcon } from "lucide-react"
import { cn } from "cn"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { formatRelativeTime } from "@/lib/time"
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

/* --------------------------------- motion -------------------------------- */

/**
 * Spring drives only the folder stack (small distances, tactile); the
 * rails grow with an ease — height plus fade reads calmer than a spring
 * stretching text.
 */
const spring: Transition = { type: "spring", stiffness: 300, damping: 20 }
const grow: Transition = { duration: 0.25, ease: "easeOut" }
const fade: Transition = { duration: 0.18, ease: "easeOut" }

/** The stack itself: indifferent at rest and hover, squeezed on press. */
const stackPose: Variants = {
  rest: { scale: 1 },
  fanned: { scale: 1 },
  squeezed: { scale: 0.98 },
}

/**
 * Sheet poses, rest → fanned. The fan is a few degrees of rotation plus a
 * drift outward — the sheets never detach, the stack just breathes open.
 * Both sheets always carry their live label so the rest state already
 * reads as state.
 */
const backSheet: Variants = {
  rest: { rotate: 5, x: 2, y: 0 },
  fanned: { rotate: 10, x: 12, y: -8 },
  squeezed: { rotate: 5, x: 2, y: 0 },
}

const frontSheet: Variants = {
  rest: { rotate: 3, x: 0, y: 0 },
  fanned: { rotate: 7, x: 9, y: -7 },
  squeezed: { rotate: 3, x: 0, y: 0 },
}

/** One node on a deliverable's rail: plain conversation or a checkpoint. */
type RailNode =
  | { kind: "comment"; at: Date; comment: MockComment }
  | { kind: "version"; at: Date; version: MockVersion }

/* ------------------------------- the variant ------------------------------ */

/**
 * Variant B — "paper stack + one rail".
 *
 * The folder is two loose sheets peeking out of a closed folder face:
 * the contents are visible without opening anything, and both sheets
 * carry live counts computed from the mock. The dialog is a single
 * cabinet drawer: deliverables as flat rows on the surface, each one
 * expanding its thread directly beneath the row, hung off one
 * background-painted hairline spine. Tasks, the deliverable's own
 * comments and version nodes share that rail in chronological order; a
 * version node is simply a marked point on the rail that unspools its
 * segment underneath itself, so nesting never goes deeper than node →
 * segment. Nothing here loads, anywhere — the mock is sync.
 */
export function DeliverablesFolderB() {
  const [open, setOpen] = useState(false)
  const [commentsOnly, setCommentsOnly] = useState(false)
  /** The one deliverable whose rail is open — controlled, never two. */
  const [expandedId, setExpandedId] = useState<string | null>(null)
  /** Version segments open within the expanded deliverable. */
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(
    new Set()
  )
  /** Locally appended comments, keyed by deliverable id or version id. */
  const [localComments, setLocalComments] = useState<
    Record<string, MockComment[]>
  >({})

  const openCount = MOCK_DELIVERABLES.filter(
    (deliverable) => deliverable.status !== "completed"
  ).length
  const versionCount = MOCK_DELIVERABLES.reduce(
    (sum, deliverable) => sum + deliverable.versions.length,
    0
  )

  function toggleDeliverable(id: string) {
    if (expandedId === id) {
      setExpandedId(null)
      return
    }
    // A switch lands on a fresh rail: segment memory belongs to one
    // thread, not to the dialog.
    setExpandedVersions(new Set())
    setExpandedId(id)
  }

  function toggleVersion(id: string) {
    setExpandedVersions((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function appendComment(key: string, body: string) {
    setLocalComments((current) => ({
      ...current,
      [key]: [
        ...(current[key] ?? []),
        {
          id: `local-${key}-${Date.now()}`,
          author: MOCK_VIEWER,
          createdAt: new Date(),
          body,
        },
      ],
    }))
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        // Every open resets to the first deliverable expanded: the
        // gallery's default frame is a live rail, never a closed list.
        if (nextOpen) {
          setExpandedId(MOCK_DELIVERABLES[0]?.id ?? null)
          setExpandedVersions(new Set())
        }
      }}
    >
      <DialogTrigger asChild>
        <motion.button
          type="button"
          variants={stackPose}
          initial="rest"
          animate="rest"
          whileHover="fanned"
          whileTap="squeezed"
          transition={spring}
          className="relative block h-36 w-52 cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/30 focus-visible:outline-solid"
        >
          {/* Loose sheets, back to front, edges carrying live counts. */}
          <motion.span
            aria-hidden
            variants={backSheet}
            transition={spring}
            className="absolute top-0 right-2 bottom-12 left-20 rounded-lg bg-card shadow-xs"
          >
            <span className="absolute top-1 right-3 text-[10px] font-medium text-muted-foreground/80">
              {versionCount} versions
            </span>
          </motion.span>
          <motion.span
            aria-hidden
            variants={frontSheet}
            transition={spring}
            className="absolute top-3 right-0 bottom-14 left-14 rounded-lg bg-card shadow-xs"
          >
            <span className="absolute top-1 right-4 text-[10px] font-medium text-muted-foreground/80">
              {openCount} open
            </span>
          </motion.span>

          {/* Folder silhouette: tab and face share one tone and join
              seamlessly; the sheets peek out above and past its edges. */}
          <span
            aria-hidden
            className="absolute top-0 left-6 h-8 w-16 rounded-t-lg bg-muted"
          />
          <span className="absolute inset-x-6 top-7 bottom-1 flex flex-col justify-end rounded-lg bg-muted p-4 shadow-xs">
            <span className="flex items-end gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-background/70 shadow-xs">
                <FolderIcon
                  aria-hidden
                  className="size-4.5 text-muted-foreground"
                />
              </span>
              <span className="flex flex-col leading-tight">
                <span className="text-sm font-medium text-foreground">
                  Work files
                </span>
                <span className="text-xs text-muted-foreground">
                  {openCount} open
                </span>
              </span>
            </span>
          </span>
        </motion.button>
      </DialogTrigger>

      {/* The drawer: flush interior, the header band stays put while only
          the rail scrolls — the dialog itself never scrolls. */}
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl lg:max-w-4xl">
        <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 bg-muted/30 px-6 py-4 pr-14 sm:flex-nowrap">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">
              {MOCK_PROJECT.title}
            </p>
            <DialogTitle className="mt-0.5 text-lg font-semibold tracking-tight">
              Work files
            </DialogTitle>
            <DialogDescription className="mt-1 text-xs text-muted-foreground">
              {openCount} of {MOCK_DELIVERABLES.length} still open ·{" "}
              {versionCount} versions on file. Pick a row to read its rail.
            </DialogDescription>
          </div>
          <FilterPill commentsOnly={commentsOnly} onChange={setCommentsOnly} />
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-1 pb-6">
          {MOCK_DELIVERABLES.map((deliverable) => (
            <DeliverableRail
              key={deliverable.id}
              deliverable={deliverable}
              expanded={expandedId === deliverable.id}
              commentsOnly={commentsOnly}
              expandedVersions={expandedVersions}
              localComments={localComments}
              onToggle={() => toggleDeliverable(deliverable.id)}
              onToggleVersion={toggleVersion}
              onAppendComment={appendComment}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------ deliverable rail --------------------------- */

/**
 * One deliverable: the flat row and, while open, its thread flowing
 * beneath the row. The spine is one continuous hairline painted on the
 * background (the file's single allowed box-line) so no border utility
 * appears anywhere, however deep the rail gets.
 */
function DeliverableRail({
  deliverable,
  expanded,
  commentsOnly,
  expandedVersions,
  localComments,
  onToggle,
  onToggleVersion,
  onAppendComment,
}: {
  deliverable: MockDeliverable
  expanded: boolean
  commentsOnly: boolean
  expandedVersions: Set<string>
  localComments: Record<string, MockComment[]>
  onToggle: () => void
  onToggleVersion: (id: string) => void
  onAppendComment: (key: string, body: string) => void
}) {
  const panelId = useId()
  const status = DELIVERABLE_DOTS[deliverable.status]
  const openTaskCount = deliverable.tasks.filter(
    (task) => task.status !== "done" && task.status !== "approved"
  ).length
  const thread = [
    ...deliverable.comments,
    ...(localComments[deliverable.id] ?? []),
  ]

  // The simple story of a deliverable: the plan first (tasks), then
  // everything said about the work — the deliverable's own comments and
  // version checkpoints share one clock, so the rail reads oldest first
  // and a version node sits exactly where its content began.
  const railNodes: RailNode[] = [
    ...thread.map((comment): RailNode => ({
      kind: "comment",
      at: comment.createdAt,
      comment,
    })),
    ...deliverable.versions.map((version): RailNode => ({
      kind: "version",
      at: version.createdAt,
      version,
    })),
  ]
  railNodes.sort((a, b) => a.at.getTime() - b.at.getTime())

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left transition-colors outline-none hover:bg-muted/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/30 focus-visible:outline-solid"
      >
        <span
          aria-hidden
          className={cn("size-3 shrink-0 rounded-full", status.dot)}
        />
        <span className="sr-only">{status.label}</span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {deliverable.title}
        </span>
        <span className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>
            {openTaskCount > 0 ? `${openTaskCount} open` : "All done"}
          </span>
          {deliverable.owner ? (
            <Avatar member={deliverable.owner} className="size-5" />
          ) : (
            <span>Unowned</span>
          )}
          {deliverable.deadline && (
            <span
              className={cn(
                deliverable.overdue && "font-medium text-destructive"
              )}
            >
              {deliverable.overdue ? "Overdue · " : "Due "}
              {formatDueDate(deliverable.deadline)}
            </span>
          )}
        </span>
      </button>

      {/* Fixed geometry spill: the row stays put, the thread flows out
          beneath it. Height on the clip alone — the content fades in
          place inside it instead of stretching with the height. */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            id={panelId}
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            transition={grow}
            className="overflow-hidden"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={fade}
              className="flex"
            >
              {/* The one spine, starting just under the row's status dot
                  and running the full depth of the thread. */}
              <span
                aria-hidden
                className="flex w-6 shrink-0 flex-col pt-2 pb-2"
              >
                <span className="w-px flex-1 self-center bg-border" />
              </span>

              <div className="min-w-0 flex-1 pt-3 pb-1">
                <p className="text-[13px] leading-snug text-muted-foreground">
                  {deliverable.owner
                    ? `Owned by ${deliverable.owner.name}`
                    : "Unowned"}
                  {deliverable.deadline && (
                    <span
                      className={cn(
                        deliverable.overdue && "font-medium text-destructive"
                      )}
                    >
                      {" · "}
                      {deliverable.overdue ? "overdue since" : "due"}{" "}
                      {formatDueDate(deliverable.deadline)}
                    </span>
                  )}
                  {deliverable.description && (
                    <span> · {deliverable.description}</span>
                  )}
                </p>

                {/* "Comments only" lifts the plan out of the rail — the
                    mode exists to keep long conversation readable, so the
                    tasks leave before the conversation does. */}
                <AnimatePresence initial={false}>
                  {!commentsOnly && (
                    <motion.div
                      key="tasks"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={grow}
                      className="mt-4 flex flex-col gap-4 overflow-hidden"
                    >
                      {deliverable.tasks.map((task) => (
                        <TaskNode key={task.id} task={task} />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="mt-4 flex flex-col gap-4">
                  {railNodes.map((node) =>
                    node.kind === "version" ? (
                      <VersionBlock
                        key={node.version.id}
                        version={node.version}
                        expanded={expandedVersions.has(node.version.id)}
                        localFeedback={localComments[node.version.id] ?? []}
                        onToggle={() => onToggleVersion(node.version.id)}
                        onAppendComment={(body) =>
                          onAppendComment(node.version.id, body)
                        }
                      />
                    ) : (
                      <CommentNode
                        key={node.comment.id}
                        comment={node.comment}
                      />
                    )
                  )}
                </div>

                <div className="mt-6">
                  <RailComposer
                    placeholder="Leave a comment…"
                    onAppend={(body) => onAppendComment(deliverable.id, body)}
                  />
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* --------------------------------- nodes ---------------------------------- */

/**
 * A task as a plan node: the lead assignee rides the marker, the title
 * carries, and the facts stay plain text — status through the dot map,
 * priority only when it is not medium (medium is the default worth of
 * noise), overdue dues destructive instead of boxed.
 */
function TaskNode({ task }: { task: MockTask }) {
  const status = TASK_DOTS[task.status]
  // `.at(0)` keeps the marker honestly nullable in both the types and the
  // truthiness; `.slice(1)` leaves the co-assignee remount untouched.
  const lead = task.assignees.at(0)
  const extras = task.assignees.slice(1)
  return (
    <div className="flex items-start gap-3">
      <span className="size-6 shrink-0">
        {lead ? (
          <Avatar member={lead} className="size-6" />
        ) : (
          <span className="flex size-6 items-center justify-center rounded-full bg-muted">
            <span
              aria-hidden
              className="size-2 rounded-full bg-muted-foreground/30"
            />
          </span>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-tight font-medium">{task.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className={cn("size-3 rounded-full", status.dot)}
            />
            {status.label}
          </span>
          {task.priority !== "medium" && (
            <span>{PRIORITY_LABELS[task.priority]}</span>
          )}
          {task.dueDate && (
            <span
              className={cn(task.overdue && "font-medium text-destructive")}
            >
              {task.overdue ? "Overdue · " : "Due "}
              {formatDueDate(task.dueDate)}
            </span>
          )}
        </div>
      </div>
      {extras.length > 0 && (
        /* Co-assignees sit apart by gap — overlap would need a ring or a
           spacer ring, and both are out of the house's diet. */
        <span className="flex shrink-0 gap-1 pt-0.5">
          {extras.map((member) => (
            <Avatar key={member.teamId} member={member} className="size-6" />
          ))}
        </span>
      )}
    </div>
  )
}

/**
 * A comment in the house's thread language: tinted author marker, name,
 * relative time, body. Used for the deliverable's own conversation and
 * for a version's feedback alike — one rhythm everywhere on the rail.
 */
function CommentNode({ comment }: { comment: MockComment }) {
  return (
    <div className="flex gap-3">
      <Avatar member={comment.author} className="size-6" />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-sm font-medium">{comment.author.name}</span>
          <span className="text-xs text-muted-foreground">
            {formatRelativeTime(comment.createdAt)}
          </span>
        </p>
        <p className="mt-1 text-sm leading-relaxed text-foreground/90">
          {comment.body}
        </p>
      </div>
    </div>
  )
}

/**
 * A version checkpoint: a round node bearing the review dot, its mono
 * label beside it. Opening it unspools only that segment directly
 * beneath the node — source, submitter's note, decision, feedback —
 * while the one rail keeps running beside everything. Depth never
 * exceeds node → segment, so nesting stays flat and instant.
 */
function VersionBlock({
  version,
  expanded,
  localFeedback,
  onToggle,
  onAppendComment,
}: {
  version: MockVersion
  expanded: boolean
  localFeedback: MockComment[]
  onToggle: () => void
  onAppendComment: (body: string) => void
}) {
  const segmentId = `segment-${version.id}`
  const review = version.reviewStatus ? REVIEW_DOTS[version.reviewStatus] : null
  const feedback = [...version.feedback, ...localFeedback]

  return (
    <div>
      {/* Flush on purpose: the marker must stay registered on the rail, so
          hover lifts tone rather than painting a wash off the columns. */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={segmentId}
        className="group flex w-full items-center gap-3 rounded-md py-1 text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/30 focus-visible:outline-solid"
      >
        <span
          aria-hidden
          className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted"
        >
          <span
            className={cn(
              "size-2 rounded-full",
              review ? review.dot : "bg-muted-foreground/30"
            )}
          />
        </span>
        <span className="font-mono text-xs font-medium">{version.label}</span>
        <span className="text-xs text-muted-foreground transition-colors group-hover:text-foreground">
          {review ? review.label : "Draft"}
        </span>
        {(version.isLatest || version.isLatestApproved) && (
          <span className="ml-auto text-xs text-muted-foreground/80">
            {version.isLatest ? "Latest" : "Latest approved"}
          </span>
        )}
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            id={segmentId}
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            transition={grow}
            className="overflow-hidden"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={fade}
              className="flex flex-col gap-3 pt-3 pb-1"
            >
              <p className="text-xs leading-relaxed text-muted-foreground">
                <span className="font-mono">{version.assetLabel}</span>
                {" · "}
                {version.sourceLabel}
                {" · "}
                {version.submitter.name ?? "Unattributed"}
                {" · "}
                {formatRelativeTime(version.createdAt)}
              </p>
              {version.submitterNotes && (
                <p className="text-[13px] leading-relaxed text-muted-foreground italic">
                  “{version.submitterNotes}”
                </p>
              )}
              {version.decision && <DecisionLine decision={version.decision} />}
              {feedback.map((comment) => (
                <CommentNode key={comment.id} comment={comment} />
              ))}
              <RailComposer
                placeholder="Reply on this version…"
                onAppend={onAppendComment}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * The reviewer's verdict as one line: the review dot for the kind, who,
 * when — and their note in their own words, quoted and muted.
 */
function DecisionLine({
  decision,
}: {
  decision: NonNullable<MockVersion["decision"]>
}) {
  const review = REVIEW_DOTS[decision.kind]
  return (
    <div className="flex flex-col gap-1">
      <p className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium">
        <span aria-hidden className={cn("size-3 rounded-full", review.dot)} />
        {review.label} by {decision.by ?? "a reviewer"}
        <span className="font-normal text-muted-foreground">
          {formatRelativeTime(decision.at)}
        </span>
      </p>
      {decision.note && (
        <p className="text-[13px] leading-relaxed text-muted-foreground italic">
          “{decision.note}”
        </p>
      )}
    </div>
  )
}

/* ------------------------------- controls --------------------------------- */

/**
 * The borderless voice of the rail: the viewer's tinted marker and a
 * bare input whose focus lands as a wash. Enter appends locally — the
 * mock world only ever moves forward, so there is no mutation layer and
 * no loading state anywhere.
 */
function RailComposer({
  placeholder,
  onAppend,
}: {
  placeholder: string
  onAppend: (body: string) => void
}) {
  const [value, setValue] = useState("")
  return (
    <div className="flex items-center gap-3">
      <Avatar member={MOCK_VIEWER} className="size-6" />
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && value.trim()) {
            onAppend(value.trim())
            setValue("")
          }
        }}
        className="h-8 w-full min-w-0 rounded-md bg-transparent px-2.5 text-sm transition-colors outline-none placeholder:text-muted-foreground/80 hover:bg-muted/30 focus-visible:bg-muted/50"
      />
    </div>
  )
}

/**
 * Two-slot pill with a sliding active wash — the tabs-switcher idiom at
 * dialog scale. The indicator is placed by slot index (both slots are
 * equal-width so no measurement is needed), and the first paint skips
 * the transition so the wash already sits under "All" on open.
 */
function FilterPill({
  commentsOnly,
  onChange,
}: {
  commentsOnly: boolean
  onChange: (next: boolean) => void
}) {
  const index = commentsOnly ? 1 : 0
  const [animated, setAnimated] = useState(false)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setAnimated(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div
      role="group"
      aria-label="Rail filter"
      className="relative flex w-56 shrink-0 rounded-full bg-muted/60 p-1"
    >
      <span
        aria-hidden
        className={cn(
          "absolute top-1 bottom-1 left-1 rounded-full bg-background shadow-xs",
          animated && "transition-transform duration-200 ease-out"
        )}
        style={{
          width: "calc((100% - 0.5rem) / 2)",
          transform: `translateX(${index * 100}%)`,
        }}
      />
      <button
        type="button"
        aria-pressed={!commentsOnly}
        onClick={() => onChange(false)}
        className={cn(
          "relative z-1 h-7 basis-1/2 rounded-full px-3 text-xs font-medium",
          commentsOnly
            ? "text-muted-foreground transition-colors hover:text-foreground"
            : "text-foreground"
        )}
      >
        All
      </button>
      <button
        type="button"
        aria-pressed={commentsOnly}
        onClick={() => onChange(true)}
        className={cn(
          "relative z-1 h-7 basis-1/2 rounded-full px-3 text-xs font-medium",
          commentsOnly
            ? "text-foreground"
            : "text-muted-foreground transition-colors hover:text-foreground"
        )}
      >
        Comments only
      </button>
    </div>
  )
}

/* --------------------------------- people --------------------------------- */

/**
 * Initials on the stable tint; the method has no size opinions, callers
 * pick — markers are 24px so they stay registered on the rail, row
 * avatars 20px so they read as facts, not people.
 */
function Avatar({
  member,
  className,
}: {
  member: MockMember
  className: string
}) {
  return (
    <span
      title={member.name}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full text-[10px] font-medium",
        tintOf(member),
        className
      )}
    >
      {initialsOf(member.name)}
    </span>
  )
}
