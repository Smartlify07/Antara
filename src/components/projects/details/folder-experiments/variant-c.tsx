/**
 * Variant C — "punched inset + version pager".
 *
 * The folder element is a die-cut pocket stamped into the page surface: a
 * muted rectangle that catches an inset shadow, with a folder tab above it
 * that cracks open a hair on hover. The dialog behind it is a two-pane
 * cabinet — deliverables on the left, one detail level on the right, with a
 * text-breadcrumb cascade (all deliverables → deliverable thread → version)
 * instead of stacked expanders. Version detail carries a ‹ › pager so the
 * reader can move through a deliverable's versions without climbing back
 * out to the list above.
 *
 * Everything is separation by tone (washes, spine, padding); no borders,
 * no ripple of loading states — the data is synchronous by construction.
 */
import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { ChevronLeftIcon, ChevronRightIcon, FolderIcon } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
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
} from "@/components/projects/details/folder-experiments/mock"
import type {
  MockComment,
  MockDeliverable,
  MockMember,
  MockTask,
  MockVersion,
} from "@/components/projects/details/folder-experiments/mock"
import { formatRelativeTime } from "@/lib/time"
import { cn } from "@/lib/utils"

/* ----------------------- data views (computed once) ---------------------- */

/**
 * Newest-first versions per deliverable — the pager's indexing and the
 * cluster rows both want "latest on top", so one shared sort case.
 */
/**
 * Newest-first versions per deliverable — the pager's indexing and the
 * cluster rows both want "latest on top", so one shared sort case. The
 * `| undefined` keeps a lookup miss representable; every read guards it.
 */
const VERSIONS_BY_DELIVERABLE: Record<string, MockVersion[] | undefined> =
  Object.fromEntries(
    MOCK_DELIVERABLES.map((deliverable) => [
      deliverable.id,
      [...deliverable.versions].sort((a, b) => b.versionNo - a.versionNo),
    ])
  )

/**
 * Open work per deliverable: tasks that are not yet done or approved.
 * The muted "N open" count on the folder block and master rows is that
 * number — a workload reading, not a review-state reading.
 */
const OPEN_TASK_COUNTS: Record<string, number | undefined> = Object.fromEntries(
  MOCK_DELIVERABLES.map((deliverable) => [
    deliverable.id,
    deliverable.tasks.filter(
      (task) => task.status !== "done" && task.status !== "approved"
    ).length,
  ])
)

const OPEN_DELIVERABLE_COUNT = MOCK_DELIVERABLES.filter(
  (deliverable) => deliverable.status !== "completed"
).length
const VERSION_COUNT = MOCK_DELIVERABLES.reduce(
  (sum, deliverable) => sum + deliverable.versions.length,
  0
)

/**
 * The mock leaves `reviewStatus` null for never-submitted drafts, and the
 * dot map has no slot for that; a neutral dot keeps the row legible without
 * reaching into the shared mock.
 */
const DRAFT_DOT = { label: "Draft", dot: "bg-muted-foreground/40" }

/** Deliverable threads and version threads live in one comment namespace. */
function threadKey(deliverableId: string, versionId?: string | null): string {
  return versionId ? `${deliverableId}:${versionId}` : deliverableId
}

/* -------------------------------- variant -------------------------------- */

export function DeliverablesFolderC() {
  const [isOpen, setIsOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(
    MOCK_DELIVERABLES[0]?.id ?? null
  )
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null)
  const [mode, setMode] = useState<"all" | "comments">("all")
  /**
   * Direction of the last detail-pane swap: 1 = drilling in / paging to an
   * older version, −1 = climbing back out / paging to a newer one, 0 = any
   * lateral change such as picking another deliverable (fade only).
   */
  const [direction, setDirection] = useState(0)
  /** Locally appended comments, keyed by thread. The composer only ever
   *  touches this variant's own state — nothing mocks a server. */
  const [addedComments, setAddedComments] = useState<
    Record<string, MockComment[]>
  >({})
  const localIdRef = useRef(0)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  /** Hover or keyboard focus both engage the folder-flap hint. */
  const [engaged, setEngaged] = useState(false)

  const reduceMotion = useReducedMotion() ?? false

  const deliverable = MOCK_DELIVERABLES.find((d) => d.id === activeId) ?? null
  const activeVersion = deliverable
    ? (VERSIONS_BY_DELIVERABLE[deliverable.id]?.find(
        (version) => version.id === activeVersionId
      ) ?? null)
    : null

  const paneKey = activeVersion
    ? `v:${activeVersion.id}`
    : deliverable
      ? `d:${deliverable.id}`
      : "all"

  // Panes swap wholly, so a scrolled thread would otherwise leave the
  // incoming pane parked mid-way down. Every navigation lands on top.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [activeId, activeVersionId])

  function selectDeliverable(id: string | null) {
    setDirection(0)
    setActiveId(id)
    setActiveVersionId(null)
  }

  function openVersion(version: MockVersion) {
    setDirection(1)
    setActiveVersionId(version.id)
  }

  /** ‹ pages to an older version (+1 in the newest-first list), › to a
   *  newer one (−1). In place, no climb back to the list. */
  function pageVersion(delta: 1 | -1) {
    if (!deliverable) return
    const versions = VERSIONS_BY_DELIVERABLE[deliverable.id] ?? []
    const index = versions.findIndex(
      (version) => version.id === activeVersionId
    )
    if (index < 0) return
    const next = versions.at(index + delta)
    if (!next) return
    setDirection(delta)
    setActiveVersionId(next.id)
  }

  function appendComment(
    deliverableId: string,
    versionId: string | null,
    body: string
  ) {
    localIdRef.current += 1
    const comment: MockComment = {
      id: `local-${localIdRef.current}`,
      author: MOCK_VIEWER,
      createdAt: new Date(),
      body,
    }
    const key = threadKey(deliverableId, versionId)
    setAddedComments((current) => ({
      ...current,
      [key]: [...(current[key] ?? []), comment],
    }))
  }

  return (
    <>
      {/* The punched pocket: the tab above it is the same muted paint and
          shares the flap hint, so silhouette and surface read as one cut. */}
      <button
        type="button"
        aria-haspopup="dialog"
        onMouseEnter={() => setEngaged(true)}
        onMouseLeave={() => setEngaged(false)}
        onFocus={() => setEngaged(true)}
        onBlur={() => setEngaged(false)}
        onClick={() => setIsOpen(true)}
        className="group block w-full max-w-sm outline-none"
      >
        <motion.span
          aria-hidden
          className="ml-6 block h-4 w-28 rounded-t-lg bg-muted/50 shadow-[inset_0_-3px_6px_rgba(0,0,0,0.04)]"
          style={{ originX: 0, originY: 1 }}
          animate={
            engaged && !reduceMotion
              ? { y: -3, rotate: -1.2 }
              : { y: 0, rotate: 0 }
          }
          transition={{ duration: 0.18, ease: "easeOut" }}
        />
        <span className="block rounded-xl bg-muted/50 p-4 shadow-[inset_0_2px_10px_rgba(0,0,0,0.08)] group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-ring">
          <span className="flex items-center gap-3 rounded-lg bg-background p-3.5 shadow-xs transition-all duration-150 ease-out group-hover:-translate-y-0.5 group-hover:shadow-sm group-active:translate-y-0 group-active:shadow-xs">
            <span
              aria-hidden
              className="grid size-10 shrink-0 place-items-center rounded-md bg-muted/70 text-muted-foreground"
            >
              <FolderIcon className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold tracking-tight">
                Work files
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {OPEN_DELIVERABLE_COUNT} open · {VERSION_COUNT} versions
              </span>
            </span>
            <ChevronRightIcon
              aria-hidden
              className="size-4 shrink-0 text-muted-foreground/70 transition-transform duration-150 ease-out group-hover:translate-x-0.5"
            />
          </span>
        </span>
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl lg:max-w-4xl">
          <DialogTitle className="sr-only">
            Work files · {MOCK_PROJECT.title}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Deliverables, tasks, versions and discussion for this project.
            Concept preview on mock data.
          </DialogDescription>

          <div className="flex min-h-0 flex-1">
            <MasterPane activeId={activeId} onSelect={selectDeliverable} />

            <div className="flex min-w-0 flex-1 flex-col">
              <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
                <div className="px-5 pt-4 pb-8">
                  {/* Below lg the master pane collapses, so this plain back
                      link returns to the level-0 list — the only route down
                      that keeps a single pane at every size. */}
                  {deliverable !== null && activeVersion === null && (
                    <button
                      type="button"
                      onClick={() => selectDeliverable(null)}
                      className="mb-3 -ml-2 flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:hidden"
                    >
                      <ChevronLeftIcon aria-hidden className="size-3.5" />
                      All deliverables
                    </button>
                  )}

                  <motion.div
                    key={paneKey}
                    initial={{
                      opacity: 0,
                      x: reduceMotion ? 0 : direction * 12,
                    }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={
                      reduceMotion
                        ? { duration: 0.15 }
                        : { duration: 0.18, ease: "easeOut" }
                    }
                  >
                    {deliverable === null ? (
                      <LevelZeroList onSelect={selectDeliverable} />
                    ) : activeVersion === null ? (
                      <LevelOne
                        deliverable={deliverable}
                        mode={mode}
                        onModeChange={setMode}
                        addedComments={addedComments}
                        onAppend={(body) =>
                          appendComment(deliverable.id, null, body)
                        }
                        onOpenVersion={openVersion}
                        reduceMotion={reduceMotion}
                      />
                    ) : (
                      <LevelTwo
                        deliverable={deliverable}
                        version={activeVersion}
                        addedComments={addedComments}
                        onAppend={(body) =>
                          appendComment(deliverable.id, activeVersion.id, body)
                        }
                        onBack={() => {
                          setDirection(-1)
                          setActiveVersionId(null)
                        }}
                        onPaginate={pageVersion}
                      />
                    )}
                  </motion.div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

/* ------------------------------ master pane ------------------------------ */

function MasterPane({
  activeId,
  onSelect,
}: {
  activeId: string | null
  onSelect: (id: string | null) => void
}) {
  return (
    <nav
      aria-label="Deliverables"
      className="hidden w-64 shrink-0 flex-col overflow-y-auto bg-muted/30 lg:flex"
    >
      <p className="px-4 pt-4 pb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Deliverables
      </p>
      <ul className="flex flex-col gap-0.5 px-2 pb-4">
        {MOCK_DELIVERABLES.map((deliverable) => {
          const meta = DELIVERABLE_DOTS[deliverable.status]
          const openCount = OPEN_TASK_COUNTS[deliverable.id] ?? 0
          const isActive = deliverable.id === activeId
          return (
            <li key={deliverable.id}>
              <button
                type="button"
                aria-current={isActive ? "true" : undefined}
                aria-label={[
                  deliverable.title,
                  meta.label,
                  openCount > 0 ? `${openCount} open` : null,
                  deliverable.owner
                    ? `owner ${deliverable.owner.name}`
                    : "unassigned",
                ]
                  .filter(Boolean)
                  .join(", ")}
                onClick={() => onSelect(deliverable.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  // The wash carries selection; hover sits a step lighter so
                  // the two states never read as the same colour.
                  isActive ? "bg-muted/40" : "hover:bg-muted/30"
                )}
              >
                <span
                  aria-hidden
                  className={cn("size-3 shrink-0 rounded-full", meta.dot)}
                />
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block truncate text-[13px] font-medium",
                      isActive ? "text-foreground" : "text-foreground/80"
                    )}
                  >
                    {deliverable.title}
                  </span>
                  {openCount > 0 && (
                    <span className="text-[11px] text-muted-foreground">
                      {openCount} open
                    </span>
                  )}
                </span>
                {deliverable.owner && (
                  <PersonAvatar member={deliverable.owner} />
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/** Level 0 — the simple list below lg falls into when a deliverable is
 *  deselected. Same rows, more air, the whole pane to themselves. */
function LevelZeroList({ onSelect }: { onSelect: (id: string) => void }) {
  return (
    <section aria-label="All deliverables">
      <h2 className="pt-2 pb-3 text-sm font-semibold tracking-tight">
        All deliverables
      </h2>
      <ul className="flex flex-col gap-0.5">
        {MOCK_DELIVERABLES.map((deliverable) => {
          const meta = DELIVERABLE_DOTS[deliverable.status]
          const openCount = OPEN_TASK_COUNTS[deliverable.id] ?? 0
          return (
            <li key={deliverable.id}>
              <button
                type="button"
                onClick={() => onSelect(deliverable.id)}
                className="flex w-full items-start gap-3 rounded-xl px-2.5 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span
                  aria-hidden
                  className={cn("mt-1 size-3 shrink-0 rounded-full", meta.dot)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {deliverable.title}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {meta.label}
                    {openCount > 0 ? ` · ${openCount} open` : ""}
                  </span>
                </span>
                {deliverable.owner && (
                  <PersonAvatar member={deliverable.owner} className="mt-0.5" />
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/* ------------------------------- level one ------------------------------- */

function LevelOne({
  deliverable,
  mode,
  onModeChange,
  addedComments,
  onAppend,
  onOpenVersion,
  reduceMotion,
}: {
  deliverable: MockDeliverable
  mode: "all" | "comments"
  onModeChange: (mode: "all" | "comments") => void
  addedComments: Record<string, MockComment[]>
  onAppend: (body: string) => void
  onOpenVersion: (version: MockVersion) => void
  reduceMotion: boolean
}) {
  const versions = VERSIONS_BY_DELIVERABLE[deliverable.id] ?? []
  const statusMeta = DELIVERABLE_DOTS[deliverable.status]
  const comments = [
    ...deliverable.comments,
    ...(addedComments[deliverable.id] ?? []),
  ]
  // Comments-only mode lifts the task nodes out of the thread with a
  // height-collapse fade; going back inserts them instantly — seeding the
  // exit is worth it, choreographing the re-entry is not.
  const visibleTasks = mode === "all" ? deliverable.tasks : []

  return (
    <section aria-label={`${deliverable.title} — deliverable thread`}>
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 pr-10">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight">
            {deliverable.title}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className={cn("size-3 rounded-full", statusMeta.dot)}
              />
              {statusMeta.label}
            </span>
            {deliverable.owner ? (
              <span className="inline-flex items-center gap-1.5">
                <PersonAvatar member={deliverable.owner} className="size-5" />
                {deliverable.owner.name}
              </span>
            ) : (
              <span>Unassigned</span>
            )}
            {deliverable.deadline && (
              <span
                className={
                  deliverable.overdue
                    ? "font-medium text-destructive"
                    : undefined
                }
              >
                {deliverable.overdue ? "Overdue · " : "due "}
                {formatDueDate(deliverable.deadline)}
              </span>
            )}
          </div>
          {deliverable.description && (
            <p className="mt-2 max-w-prose text-sm text-muted-foreground">
              {deliverable.description}
            </p>
          )}
        </div>

        <ThreadModeToggle
          value={mode}
          onChange={onModeChange}
          reduceMotion={reduceMotion}
        />
      </header>

      <ul className="mt-7">
        <AnimatePresence initial={false}>
          {visibleTasks.map((task) => (
            <motion.li
              key={task.id}
              initial={false}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              style={{ overflow: "hidden" }}
            >
              <TaskThreadItem task={task} />
            </motion.li>
          ))}
        </AnimatePresence>
        {comments.map((comment) => (
          <li key={comment.id}>
            <ThreadCommentItem comment={comment} />
          </li>
        ))}
      </ul>

      <MiniComposer
        className="mt-1"
        label={`Add a comment to ${deliverable.title}`}
        onAppend={onAppend}
      />

      {/* The versions cluster: a flat drawer, deliberately not an accordion —
          every row opens its own detail level, nothing expands in place. */}
      <section aria-label={`Versions of ${deliverable.title}`} className="mt-8">
        <div className="rounded-xl bg-muted/30 p-2">
          <div className="flex items-baseline justify-between px-2 pt-1.5 pb-1">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Versions
            </h3>
            <span className="text-xs text-muted-foreground">
              {versions.length} {versions.length === 1 ? "version" : "versions"}
            </span>
          </div>
          {versions.length === 0 ? (
            <p className="px-2 pt-1 pb-2 text-xs text-muted-foreground">
              No versions yet — nothing has been submitted for review.
            </p>
          ) : (
            <ul className="flex flex-col">
              {versions.map((version) => {
                const reviewMeta = version.reviewStatus
                  ? REVIEW_DOTS[version.reviewStatus]
                  : DRAFT_DOT
                return (
                  <li key={version.id}>
                    <button
                      type="button"
                      aria-label={[
                        `${version.label}, ${version.assetLabel}`,
                        reviewMeta.label,
                        version.feedback.length > 0
                          ? `${version.feedback.length} notes of feedback`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                      onClick={() => onOpenVersion(version)}
                      className="group flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      <span className="font-mono text-xs text-muted-foreground">
                        {version.label}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {version.assetLabel}
                      </span>
                      <Dot dot={reviewMeta.dot} label={reviewMeta.label} />
                      <span className="hidden shrink-0 text-[11px] text-muted-foreground sm:block">
                        {version.submitter.name ?? "Former member"} ·{" "}
                        {formatRelativeTime(version.createdAt)}
                      </span>
                      {version.feedback.length > 0 && (
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {version.feedback.length} notes
                        </span>
                      )}
                      <ChevronRightIcon
                        aria-hidden
                        className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity duration-150 group-hover:opacity-70 group-focus-visible:opacity-70"
                      />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </section>
    </section>
  )
}

/* ------------------------------- level two ------------------------------- */

function LevelTwo({
  deliverable,
  version,
  addedComments,
  onAppend,
  onBack,
  onPaginate,
}: {
  deliverable: MockDeliverable
  version: MockVersion
  addedComments: Record<string, MockComment[]>
  onAppend: (body: string) => void
  onBack: () => void
  onPaginate: (delta: 1 | -1) => void
}) {
  const versions = VERSIONS_BY_DELIVERABLE[deliverable.id] ?? []
  const index = versions.findIndex((current) => current.id === version.id)
  const reviewMeta = version.reviewStatus
    ? REVIEW_DOTS[version.reviewStatus]
    : DRAFT_DOT
  const feedback = [
    ...version.feedback,
    ...(addedComments[threadKey(deliverable.id, version.id)] ?? []),
  ]

  return (
    <section aria-label={`${version.label} of ${version.assetLabel}`}>
      <button
        type="button"
        onClick={onBack}
        className="-ml-2 flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <ChevronLeftIcon aria-hidden className="size-3.5" />
        Back to {deliverable.title}
      </button>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-x-6 gap-y-4 pr-10">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight break-words">
            <span className="font-mono text-muted-foreground">
              {version.label}
            </span>
            {" — "}
            {version.assetLabel}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
            <Dot dot={reviewMeta.dot} label={reviewMeta.label} />
            <span>{version.sourceLabel}</span>
            <span className="inline-flex items-center gap-1.5">
              <NameAvatar name={version.submitter.name} className="size-5" />
              {version.submitter.name ?? "Former member"} ·{" "}
              {formatRelativeTime(version.createdAt)}
            </span>
          </div>

          {version.submitterNotes && (
            <p className="mt-3 max-w-prose text-sm text-muted-foreground">
              “{version.submitterNotes}”
            </p>
          )}

          {/* The decision lives on a wash — the strongest tone in the level,
              because it is the one fact the reader scans for. */}
          {version.decision && (
            <div className="mt-3 flex max-w-prose items-start gap-2.5 rounded-lg bg-muted/40 px-3.5 py-2.5">
              <span
                aria-hidden
                className={cn(
                  "mt-1 size-3 shrink-0 rounded-full",
                  REVIEW_DOTS[version.decision.kind].dot
                )}
              />
              <div className="min-w-0">
                <p className="text-xs font-medium">
                  {REVIEW_DOTS[version.decision.kind].label} by{" "}
                  {version.decision.by ?? "a former member"}
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    · {formatRelativeTime(version.decision.at)}
                  </span>
                </p>
                {version.decision.note && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {version.decision.note}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <VersionPager
          versions={versions}
          index={index}
          onPaginate={onPaginate}
        />
      </div>

      <div className="mt-6 flex flex-col gap-1">
        {feedback.length === 0 && (
          <p className="mb-1 text-xs text-muted-foreground">
            No feedback on this version yet.
          </p>
        )}
        <ul>
          {feedback.map((comment) => (
            <li key={comment.id}>
              <ThreadCommentItem comment={comment} />
            </li>
          ))}
        </ul>
        <MiniComposer
          label={`Add feedback on ${version.label}`}
          onAppend={onAppend}
        />
      </div>
    </section>
  )
}

/* ------------------------------- fragments ------------------------------- */

/** ‹ › version pager. ‹ walks to an older version, › to a newer one; the
 *  current version and the count sit between them. Disabled at the ends —
 *  the control is slim enough to live inside the level's header. */
function VersionPager({
  versions,
  index,
  onPaginate,
}: {
  versions: MockVersion[]
  index: number
  onPaginate: (delta: 1 | -1) => void
}) {
  const current = versions.at(index)
  const older = versions.at(index + 1)
  const newer = versions.at(index - 1)

  return (
    <div
      role="group"
      aria-label="Version pager"
      className="flex shrink-0 items-center gap-0.5 rounded-lg bg-muted/40 p-1"
    >
      <button
        type="button"
        disabled={!older}
        aria-label={older ? `Older version (${older.label})` : "Oldest version"}
        onClick={() => onPaginate(1)}
        className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-40"
      >
        <ChevronLeftIcon aria-hidden className="size-3.5" />
      </button>
      <span className="flex items-baseline gap-1 rounded-md bg-background px-2.5 py-1 shadow-xs">
        <span className="font-mono text-xs text-foreground">
          {current?.label ?? "—"}
        </span>
        <span className="text-xs text-muted-foreground">
          of {versions.length}
        </span>
      </span>
      <button
        type="button"
        disabled={!newer}
        aria-label={newer ? `Newer version (${newer.label})` : "Newest version"}
        onClick={() => onPaginate(-1)}
        className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-40"
      >
        <ChevronRightIcon aria-hidden className="size-3.5" />
      </button>
    </div>
  )
}

/** The All / Comments-only control. One shared sliding pill, the TabsSwitcher
 *  idiom without the Radix wiring — framer's layoutId keeps the pill glued
 *  to whichever segment is active, and unequal labels keep their own width. */
function ThreadModeToggle({
  value,
  onChange,
  reduceMotion,
}: {
  value: "all" | "comments"
  onChange: (value: "all" | "comments") => void
  reduceMotion: boolean
}) {
  const options: { value: "all" | "comments"; label: string }[] = [
    { value: "all", label: "All" },
    { value: "comments", label: "Comments only" },
  ]

  return (
    <div
      role="group"
      aria-label="Thread filter"
      className="inline-flex shrink-0 items-center rounded-lg bg-muted/60 p-0.5"
    >
      {options.map((option) => {
        const isActive = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              isActive
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {isActive && (
              <motion.span
                aria-hidden
                layoutId="folder-c-mode-pill"
                initial={false}
                className="absolute inset-0 rounded-md bg-background shadow-xs"
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { duration: 0.2, ease: [0.22, 1, 0.36, 1] }
                }
              />
            )}
            <span className="relative">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}

/** The thread's one-line composer: a borderless input on a soft wash.
 *  Enter commits to local state — instant, no secondary affordance. */
function MiniComposer({
  label,
  onAppend,
  className,
}: {
  label: string
  onAppend: (body: string) => void
  className?: string
}) {
  const [draft, setDraft] = useState("")

  return (
    <form
      className={className}
      onSubmit={(event) => {
        event.preventDefault()
        const body = draft.trim()
        if (body === "") return
        onAppend(body)
        setDraft("")
      }}
    >
      <input
        aria-label={label}
        value={draft}
        placeholder="Leave a comment…"
        onChange={(event) => setDraft(event.target.value)}
        className="w-full rounded-lg bg-muted/40 px-3.5 py-2.5 text-sm transition-colors placeholder:text-muted-foreground hover:bg-muted/60 focus:bg-muted/60 focus:outline-none"
      />
    </form>
  )
}

/** A task as a thread node. The assignee faces rest at the head of the
 *  item; status, priority and due live in a quiet second row. */
function TaskThreadItem({ task }: { task: MockTask }) {
  const statusMeta = TASK_DOTS[task.status]

  return (
    <div className="flex gap-3.5 pb-5">
      <span aria-hidden className="w-px shrink-0 bg-border" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {task.assignees.length > 0 && (
            <span className="flex items-center gap-1">
              {task.assignees.map((assignee) => (
                <PersonAvatar key={assignee.teamId} member={assignee} />
              ))}
            </span>
          )}
          <span className="text-sm font-medium">{task.title}</span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <Dot dot={statusMeta.dot} label={statusMeta.label} />
          {/* Medium priority is the room tone: only deviations get text. */}
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
        {task.description && (
          <p className="mt-1.5 max-w-prose text-xs leading-relaxed text-muted-foreground">
            {task.description}
          </p>
        )}
      </div>
    </div>
  )
}

/** A comment as a thread node — shared by deliverable threads and version
 *  feedback so both levels speak the same language. */
function ThreadCommentItem({ comment }: { comment: MockComment }) {
  return (
    <div className="flex gap-3.5 pb-5">
      <span aria-hidden className="w-px shrink-0 bg-border" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <PersonAvatar member={comment.author} />
          <span className="text-sm font-medium">{comment.author.name}</span>
          <span className="text-xs text-muted-foreground">
            {formatRelativeTime(comment.createdAt)}
          </span>
        </div>
        <p className="mt-1 max-w-prose text-sm leading-relaxed text-foreground/90">
          {comment.body}
        </p>
      </div>
    </div>
  )
}

/* ----------------------------- small helpers ----------------------------- */

/** 12px filled dot + plain label — the colour of a chip, without the box. */
function Dot({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className={cn("size-3 shrink-0 rounded-full", dot)} />
      {label}
    </span>
  )
}

/** Tinted initials avatar. Always aria-hidden — everywhere it appears, the
 *  person's name is spelled out beside it or inside the row's aria-label. */
function PersonAvatar({
  member,
  className,
}: {
  member: MockMember
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
        className,
        tintOf(member)
      )}
    >
      {initialsOf(member.name)}
    </span>
  )
}

/** Neutral initials avatar for submitters, whom the mock knows by name
 *  only — no team id, so no tint. */
function NameAvatar({
  name,
  className,
}: {
  name: string | null
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground",
        className
      )}
    >
      {initialsOf(name)}
    </span>
  )
}
