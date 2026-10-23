/**
 * The deliverables cabinet — the production descendant of the approved
 * Variant C concept (`folder-experiments/variant-c.tsx`), wired to the real
 * lane services instead of the mock.
 *
 * On the Work tab, users see only the punched pocket; its dialog is the
 * two-pane cabinet the concept drew — deliverables on the left, the selected
 * deliverable's detail on the right, and version detail one drill deeper
 * with a ‹ › pager. Editing affordances and gates are ported verbatim from
 * `deliverable-card.tsx` (status machine menu, owner and deadline as pills)
 * and `versions-section.tsx` (submit for review, delete draft, decide,
 * composer).
 *
 * House bans honoured: no borders, no spinners — hierarchy comes from
 * washes, spacing, the shared meta dots, and text tone.
 */
import { useEffect, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useParams } from "@tanstack/react-router"
import {
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FolderIcon,
  LinkIcon,
  PlusIcon,
  TagIcon,
  Trash2Icon,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Chip, ChipOption } from "@/components/projects/chip"
import { DateChip } from "@/components/projects/dates-chip"
import { OwnerChip } from "@/components/projects/member-chip"
import {
  buildOptimisticDeliverableComment,
  deliverableKeys,
  deliverableThreadQuery,
  stampDeliverableOverdue,
  useDeliverableCardWrite,
} from "@/lib/queries/deliverables"
import type {
  DeliverableDeadlineVars,
  DeliverableOwnerVars,
  DeliverableStatusVars,
} from "@/lib/queries/deliverables"
import { deliverableVersionsQuery, versionKeys } from "@/lib/queries/versions"
import {
  addDeliverableCommentFn,
  setDeliverableDeadlineFn,
  setDeliverableOwnerFn,
  setDeliverableStatusFn,
} from "@/server/functions/deliverables"
import {
  decideVersionFn,
  deleteDraftVersionFn,
  submitForReviewFn,
} from "@/server/functions/versions"
import { useSession } from "@/lib/auth-client"
import { avatarTint } from "@/lib/avatar-tint"
import { formatDueDate, formatRelativeTime, fromIsoDay } from "@/lib/time"
import { formatBytes } from "@/components/projects/cloudinary-assets"
import { cn } from "@/lib/utils"
import type {
  DeliverableCard,
  DeliverableThreadMessage,
} from "@/server/services/deliverable-service"
import type { TaskCard } from "@/server/services/task-service"
import type { AssignableMember } from "@/server/services/project-service"
import type {
  DeliverableVersionsResult,
  VersionItem,
} from "@/server/services/version-service"
import {
  DELIVERABLE_DOTS,
  DELIVERABLE_META,
  DELIVERABLE_STATUS_ORDER,
  TASK_DOTS,
  TASK_PRIORITY_META,
  TASK_STATUS_META,
  deliverableMoveTargets,
} from "./deliverable-meta"
import { DECISION_META, REVIEW_DOTS, REVIEW_STATUS_META } from "./version-meta"
import { TaskComposer } from "./task-composer"
import { VersionThread } from "./version-thread"
import { VersionComposer } from "./version-composer"
import {
  ThreadComposer,
  ThreadEmpty,
  ThreadError,
  ThreadLoading,
  ThreadRow,
} from "./work-comments"

type DecisionKind = "approved" | "rejected" | "changes_requested"

/**
 * The meta files have no slot for a never-submitted version (its review
 * status is NULL on the wire), so the cabinet keeps the concept's neutral
 * draft reading locally — the only dot not from a meta map, and only
 * because the maps genuinely lack the state.
 */
const DRAFT_REVIEW_META = {
  label: "Draft",
  dot: "bg-muted-foreground/40",
  badgeClass: "bg-muted text-muted-foreground",
}

/**
 * A due date reads as danger once the day is behind or immediately ahead:
 * past due, today, or inside the next three days. The caller gates on the
 * work still being live (the service's overdue predicate already excludes
 * done tasks and completed deliverables) so finished work never alarms.
 */
const DUE_SOON_MS = 3 * 24 * 60 * 60 * 1000

function dueSoon(isoDay: string): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return fromIsoDay(isoDay).getTime() - today.getTime() <= DUE_SOON_MS
}

/**
 * One row in the flat version list: the service nests versions under
 * assets, but both cabinet levels want them flat — the cluster for rows,
 * the pager for the `‹ vN of N ›` index (scoped to the version's own asset,
 * so paging never swaps the file out from under the reader).
 */
interface CabinetVersionRow {
  version: VersionItem
  assetId: string
  assetFilename: string
}

/* ----------------------------- deliverable cabinet ------------------------ */

export function DeliverablesCabinet({
  workspaceId,
  projectId,
  workspaceSlug,
  deliverables,
  tasks,
  tasksViewer,
  deliverablesViewer,
  members,
  onChanged,
}: {
  workspaceId: string
  projectId: string
  workspaceSlug: string
  /** Already loaded by the panel — never re-queried here. */
  deliverables: DeliverableCard[]
  /** Project tasks; the cabinet filters per deliverable locally. */
  tasks: TaskCard[]
  /** From the tasks query cache — gates the deliverable-thread composer. */
  tasksViewer: { canWork: boolean }
  /** From the deliverables list — gates owner/deadline management. */
  deliverablesViewer: { canManage: boolean }
  members: AssignableMember[]
  /** The panel's global refresher, per the panel's `refresh`. */
  onChanged: () => void
}) {
  const queryClient = useQueryClient()
  const reduceMotion = useReducedMotion() ?? false

  const [isOpen, setIsOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null)
  const [mode, setMode] = useState<"all" | "comments">("all")
  /**
   * Direction of the last detail-pane swap: 1 = drilling in / paging to an
   * older version, −1 = climbing back out / paging to a newer one, 0 = a
   * lateral change such as picking another deliverable (fade only).
   */
  const [direction, setDirection] = useState(0)
  // Hover or keyboard focus both engage the folder-flap hint.
  const [engaged, setEngaged] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  // The task links need the ambient project slug. The cabinet only ever
  // mounts inside the project detail page, so the same loose read
  // `app-shell.tsx` uses picks it up — the props stay the panel's contract.
  const { projectSlug } = useParams({ strict: false })

  const openCount = deliverables.filter(
    (deliverable) => deliverable.status !== "completed"
  ).length
  const versionTotal = deliverables.reduce(
    (sum, deliverable) => sum + deliverable.versionCount,
    0
  )

  /**
   * Open work per deliverable: tasks that are not yet done or approved —
   * the workload reading the concept put on every row and the pocket.
   */
  const openCountByDeliverable = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const task of tasks) {
      if (task.deliverableId === null) continue
      if (task.status !== "done" && task.status !== "approved") {
        counts[task.deliverableId] = (counts[task.deliverableId] ?? 0) + 1
      }
    }
    return counts
  }, [tasks])

  const tasksByDeliverable = useMemo(() => {
    const grouped: Record<string, TaskCard[]> = {}
    for (const task of tasks) {
      if (task.deliverableId === null) continue
      grouped[task.deliverableId] = grouped[task.deliverableId] ?? []
      grouped[task.deliverableId].push(task)
    }
    return grouped
  }, [tasks])

  /**
   * The versions timeline, fetched only while the dialog is open and a
   * deliverable is active. On revisit the cached per-deliverable entry
   * repaints instantly and the refetch follows.
   */
  const versionsQuery = useQuery({
    ...deliverableVersionsQuery(workspaceId, projectId, activeId ?? ""),
    enabled: isOpen && activeId !== null,
  })

  // Newest-first per asset — the flat cluster's rows and the pager's index
  // both read from this list.
  const versionRows: CabinetVersionRow[] = useMemo(
    () =>
      versionsQuery.data?.assets.flatMap((asset) =>
        asset.versions.map((version) => ({
          version,
          assetId: asset.id,
          assetFilename: asset.filename,
        }))
      ) ?? [],
    [versionsQuery.data]
  )

  const deliverable =
    deliverables.find((current) => current.id === activeId) ?? null
  const activeRow = activeVersionId
    ? (versionRows.find((row) => row.version.id === activeVersionId) ?? null)
    : null

  // A deleted draft drops out of the flat rows; before the stale id can
  // wedge the detail pane, climb back to the deliverable — the same unwind
  // direction the explicit back affordance uses.
  useEffect(() => {
    if (activeVersionId !== null && activeRow === null) {
      setDirection(-1)
      setActiveVersionId(null)
    }
  }, [activeVersionId, activeRow])

  const activeVersion = activeRow?.version ?? null

  const paneKey = activeVersion
    ? `v:${activeVersion.id}`
    : deliverable
      ? `d:${deliverable.id}`
      : "all"

  // Panes swap wholly, so a scrolled thread would otherwise leave the
  // incoming pane parked mid-way down. Every navigation lands on top.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [activeId, activeVersionId, mode])

  /**
   * Ported from versions-section's refresh: a version write touches the
   * timeline, its thread, the Reviews queue and badge — all under the
   * `versions` family on purpose — while the card's version count lives
   * under `deliverables.byProject`, which the panel's `onChanged` covers.
   */
  function refreshVersions() {
    void queryClient.invalidateQueries({ queryKey: versionKeys.all })
    onChanged()
  }

  function openCabinet() {
    // The concept never sat on an empty detail pane: arriving with no
    // selection lands on the first deliverable, like the mock did.
    if (activeId === null && deliverables.length > 0) {
      setActiveId(deliverables[0].id)
    }
    setIsOpen(true)
  }

  function selectDeliverable(id: string | null) {
    setDirection(0)
    setActiveId(id)
    setActiveVersionId(null)
  }

  function openVersion(row: CabinetVersionRow) {
    setDirection(1)
    setActiveVersionId(row.version.id)
  }

  /** ‹ pages to an older version (+1 in the newest-first list), › to a
   *  newer one (−1). Scoped to the active version's asset, in place. */
  function pageVersion(delta: 1 | -1) {
    if (!activeRow) return
    const pagerRows = versionRows.filter(
      (row) => row.assetId === activeRow.assetId
    )
    const index = pagerRows.findIndex(
      (row) => row.version.id === activeVersionId
    )
    if (index < 0) return
    const next = pagerRows.at(index + delta)
    if (!next) return
    setDirection(delta)
    setActiveVersionId(next.version.id)
  }

  return (
    <>
      {/* The punched pocket, from the concept: the tab above it shares the
          same muted paint and the flap hint, so silhouette and surface read
          as one cut. The counts here are real lane numbers. */}
      <button
        type="button"
        disabled={deliverables.length === 0}
        aria-haspopup="dialog"
        onMouseEnter={() => setEngaged(true)}
        onMouseLeave={() => setEngaged(false)}
        onFocus={() => setEngaged(true)}
        onBlur={() => setEngaged(false)}
        onClick={openCabinet}
        className="group block w-full max-w-sm outline-none disabled:pointer-events-none"
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
                {openCount} open · {deliverables.length} deliverables ·{" "}
                {versionTotal} versions
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
        <DialogContent className="flex h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1100px]">
          <DialogTitle className="sr-only">Work files</DialogTitle>
          <DialogDescription className="sr-only">
            Deliverables, tasks, versions and discussion for this project.
          </DialogDescription>

          <div className="flex min-h-0 flex-1">
            <MasterPane
              activeId={activeId}
              onSelect={selectDeliverable}
              deliverables={deliverables}
              openCountByDeliverable={openCountByDeliverable}
            />

            <div className="flex min-w-0 flex-1 flex-col">
              <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
                <div className="px-5 pt-4 pb-8">
                  {/* Below lg the master pane collapses, so this plain back
                      link returns to the level-0 list — the only route down
                      that keeps a single pane at every size. */}
                  {deliverable !== null && activeRow === null && (
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
                      <LevelZeroList
                        onSelect={selectDeliverable}
                        deliverables={deliverables}
                        openCountByDeliverable={openCountByDeliverable}
                      />
                    ) : activeRow === null ? (
                      <LevelOne
                        workspaceId={workspaceId}
                        projectId={projectId}
                        workspaceSlug={workspaceSlug}
                        projectSlug={projectSlug}
                        deliverable={deliverable}
                        tasks={tasksByDeliverable[deliverable.id] ?? []}
                        members={members}
                        canManage={deliverablesViewer.canManage}
                        canWork={tasksViewer.canWork}
                        mode={mode}
                        onModeChange={setMode}
                        versionsData={versionsQuery.data}
                        versionsPending={versionsQuery.isPending}
                        versionsError={versionsQuery.error}
                        onOpenVersion={openVersion}
                        onChanged={onChanged}
                        onVersionChanged={refreshVersions}
                      />
                    ) : (
                      <LevelTwo
                        workspaceId={workspaceId}
                        projectId={projectId}
                        deliverable={deliverable}
                        rows={versionRows}
                        row={activeRow}
                        canSubmit={
                          versionsQuery.data?.viewer.canSubmit ?? false
                        }
                        canDecide={
                          versionsQuery.data?.viewer.canDecide ?? false
                        }
                        onChanged={refreshVersions}
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

/* ------------------------------ master pane ------------------------------- */

/**
 * The left pane's flat deliverable list (desktop; below lg the LevelZeroList
 * takes over). Morphology from the concept, real values from the card rows:
 * dot + title + open work + deadline, owner face. The pending lane never
 * reaches here — the panel only mounts the cabinet once the lists settle.
 */
function MasterPane({
  activeId,
  onSelect,
  deliverables,
  openCountByDeliverable,
}: {
  activeId: string | null
  onSelect: (id: string | null) => void
  deliverables: DeliverableCard[]
  openCountByDeliverable: Record<string, number>
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
        {deliverables.map((deliverable) => {
          const openCount = openCountByDeliverable[deliverable.id] ?? 0
          const isActive = deliverable.id === activeId
          return (
            <li key={deliverable.id}>
              <button
                type="button"
                aria-current={isActive ? "true" : undefined}
                aria-label={[
                  deliverable.title,
                  DELIVERABLE_META[deliverable.status].label,
                  openCount > 0 ? `${openCount} open` : null,
                  deliverable.owner
                    ? `owner ${deliverable.owner.name ?? deliverable.owner.email ?? "member"}`
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
                  className={cn(
                    "size-2.5 shrink-0 rounded-full",
                    DELIVERABLE_DOTS[deliverable.status]
                  )}
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
                  <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                    {[
                      DELIVERABLE_META[deliverable.status].label,
                      deliverable.deadline
                        ? deliverable.overdue
                          ? `overdue ${formatDueDate(deliverable.deadline)}`
                          : `due ${formatDueDate(deliverable.deadline)}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    {openCount > 0 ? ` · ${openCount} open` : ""}
                  </span>
                </span>
                {deliverable.owner && (
                  <TintedAvatar
                    seed={deliverable.owner.teamId}
                    name={deliverable.owner.name}
                  />
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/** Level 0 — the simple list the below-lg fallback falls into when a
 *  deliverable is deselected. Same rows, more air, the whole pane to
 *  themselves. */
function LevelZeroList({
  onSelect,
  deliverables,
  openCountByDeliverable,
}: {
  onSelect: (id: string) => void
  deliverables: DeliverableCard[]
  openCountByDeliverable: Record<string, number>
}) {
  return (
    <section aria-label="All deliverables">
      <h2 className="pt-2 pb-3 text-sm font-semibold tracking-tight">
        All deliverables
      </h2>
      {deliverables.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No deliverables yet — the project lead or a workspace admin will shape
          the work here.
        </p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {deliverables.map((deliverable) => {
            const openCount = openCountByDeliverable[deliverable.id] ?? 0
            return (
              <li key={deliverable.id}>
                <button
                  type="button"
                  onClick={() => onSelect(deliverable.id)}
                  className="flex w-full items-start gap-3 rounded-xl px-2.5 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "mt-1 size-2.5 shrink-0 rounded-full",
                      DELIVERABLE_DOTS[deliverable.status]
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {deliverable.title}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {DELIVERABLE_META[deliverable.status].label}
                      {openCount > 0 ? ` · ${openCount} open` : ""}
                    </span>
                  </span>
                  {deliverable.owner && (
                    <TintedAvatar
                      seed={deliverable.owner.teamId}
                      name={deliverable.owner.name}
                      className="mt-0.5"
                    />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/* ------------------------------- level one -------------------------------- */

/** The cache's `owner` ref for a member — the same fields the server writes
 * from its `ownerSelect()` join, so the optimistic paint reads exactly like
 * the settled row. */
function ownerRef(member: AssignableMember): DeliverableCard["owner"] {
  return {
    teamId: member.teamId,
    name: member.name,
    email: member.email,
    image: member.image,
  }
}

/**
 * The selected deliverable's detail: header meta with the card's editing
 * affordances (status machine menu from `deliverable-card.tsx`; owner and
 * deadline as the same house pills, gated as the card gated them), its
 * task thread, and its own conversation on the shared work-comments pieces.
 * The versions cluster rides on the timeline the cabinet already holds —
 * flat rows, each drilling into level two.
 */
function LevelOne({
  workspaceId,
  projectId,
  workspaceSlug,
  projectSlug,
  deliverable,
  tasks,
  members,
  canManage,
  canWork,
  mode,
  onModeChange,
  versionsData,
  versionsPending,
  versionsError,
  onOpenVersion,
  onChanged,
  onVersionChanged,
}: {
  workspaceId: string
  projectId: string
  workspaceSlug: string
  /** Ambient route param for the task links (see the cabinet's note). */
  projectSlug: string | undefined
  deliverable: DeliverableCard
  /** This deliverable's tasks, already filtered by the cabinet. */
  tasks: TaskCard[]
  members: AssignableMember[]
  /**
   * The list viewer's manage fact. `deliverable-card` gated these affordances
   * on the row-stamped `viewerCanManage`; the list viewer is stamped by the
   * same predicate (`canManageDeliverables`), so this is that gate by value.
   */
  canManage: boolean
  /** Same write fact the card gated the task composer with. */
  canWork: boolean
  mode: "all" | "comments"
  onModeChange: (mode: "all" | "comments") => void
  versionsData: DeliverableVersionsResult | undefined
  versionsPending: boolean
  versionsError: unknown
  onOpenVersion: (row: CabinetVersionRow) => void
  onChanged: () => void
  onVersionChanged: () => void
}) {
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  const reduceMotion = useReducedMotion() ?? false

  // Edit-affordance state, ported from deliverable-card. The three writes
  // below (`useDeliverableCardWrite`) paint the project's deliverable cache
  // first — the same paint-first contract the project details pills use — so
  // owner and deadline edits need no dialog state of their own: the pills
  // commit straight through those writes. `busy` is the union of the writes'
  // pending flags, gating the status machine one round at a time.
  const [error, setError] = useState<string | null>(null)

  // The "New version" composer rides on versions-section's open/save flow:
  // opened from the cluster header, closed by its own save-or-cancel result.
  const [composerOpen, setComposerOpen] = useState(false)

  // The thread's compose state lives here; the mutation below clears it.
  const [body, setBody] = useState("")
  const [serverPostError, setServerPostError] = useState<string | null>(null)

  const meta = DELIVERABLE_META[deliverable.status]
  const targets = deliverableMoveTargets(deliverable.status)

  // Comments-only mode lifts the task nodes out of the thread with a
  // height-collapse fade; going back inserts them instantly — seeding the
  // exit is worth it, choreographing the re-entry is not.
  const visibleTasks = mode === "all" ? tasks : []

  // The deliverable's own conversation, on the same optimistic mutation the
  // version thread runs (`version-thread.tsx`), aimed at the deliverable
  // comment fn and the `deliverables.thread` key.
  const {
    data: messages = [],
    isPending: threadPending,
    error: threadError,
  } = useQuery(deliverableThreadQuery(workspaceId, projectId, deliverable.id))

  const threadKey = deliverableKeys.thread(deliverable.id)

  const post = useMutation({
    // The body rides in as the mutation variable: the optimistic row is built
    // from what was typed at mutate time, not from whatever state holds later.
    mutationFn: (messageBody: string) =>
      addDeliverableCommentFn({
        data: {
          workspaceId,
          projectId,
          deliverableId: deliverable.id,
          body: messageBody,
        },
      }),
    onMutate: async (messageBody) => {
      await queryClient.cancelQueries({ queryKey: threadKey })

      // Coalesced to an empty thread on purpose: the very first post happens
      // against a cache that does not exist yet, and skipping the write there
      // would strand the row. Oldest-first thread, so the entry lands at the
      // end — where the server's row will sit after the settle refetch.
      const snapshot =
        queryClient.getQueryData<DeliverableThreadMessage[]>(threadKey) ?? []
      const optimistic = buildOptimisticDeliverableComment(messageBody, {
        authorId: session?.user.id ?? "",
        authorName: session?.user.name ?? null,
        authorEmail: session?.user.email ?? null,
      })
      queryClient.setQueryData<DeliverableThreadMessage[]>(threadKey, [
        ...snapshot,
        optimistic,
      ])

      return { optimisticId: optimistic.id }
    },
    onError: (_error, _messageBody, context) => {
      // Rollback drops just this entry by its optimistic id: restoring the
      // snapshot would also revert anything that landed in the thread while
      // the post was in flight — including other people's comments.
      queryClient.setQueryData<DeliverableThreadMessage[]>(
        threadKey,
        (current = []) =>
          current.filter((row) => row.id !== context?.optimisticId)
      )
      setServerPostError("Could not post the comment.")
    },
    onSuccess: () => {
      // Cleared only once the server has the message — a rejected post keeps
      // what was typed and can be retried.
      setBody("")
      setServerPostError(null)
    },
    onSettled: () => {
      // The optimistic append may not equal what the server wrote (another
      // comment could weave in mid-flight), so the settle refetch of the
      // thread key, not the local append, is the final word.
      void queryClient.invalidateQueries({ queryKey: threadKey })
    },
  })

  // Deliverable writes paint first (see `useDeliverableCardWrite` in
  // queries/deliverables.ts): each patches this deliverable's cached card,
  // rolls back on a refusal, and refetches through `onChanged` to settle —
  // so status, owner and deadline changes read as instant while the round
  // trip decides.
  const statusWrite = useDeliverableCardWrite<DeliverableStatusVars>({
    projectId,
    onError: setError,
    settle: onChanged,
    action: (vars) =>
      setDeliverableStatusFn({
        data: {
          workspaceId,
          projectId,
          deliverableId: vars.deliverableId,
          status: vars.status,
        },
      }),
    optimistic: (card, vars) => ({
      ...card,
      status: vars.status,
      overdue: stampDeliverableOverdue(card.deadline, vars.status),
    }),
  })
  const ownerWrite = useDeliverableCardWrite<DeliverableOwnerVars>({
    projectId,
    onError: setError,
    settle: onChanged,
    action: (vars) =>
      setDeliverableOwnerFn({
        data: {
          workspaceId,
          projectId,
          deliverableId: vars.deliverableId,
          ownerId: vars.ownerId,
        },
      }),
    optimistic: (card, vars) => ({ ...card, owner: vars.owner }),
  })
  const deadlineWrite = useDeliverableCardWrite<DeliverableDeadlineVars>({
    projectId,
    onError: setError,
    settle: onChanged,
    action: (vars) =>
      setDeliverableDeadlineFn({
        data: {
          workspaceId,
          projectId,
          deliverableId: vars.deliverableId,
          deadline: vars.deadline,
        },
      }),
    optimistic: (card, vars) => ({
      ...card,
      deadline: vars.deadline,
      overdue: stampDeliverableOverdue(vars.deadline, card.status),
    }),
  })
  const busy =
    statusWrite.isPending || ownerWrite.isPending || deadlineWrite.isPending

  const clusterTotal =
    versionsData?.assets.reduce(
      (sum, asset) => sum + asset.versions.length,
      0
    ) ?? 0

  return (
    <section aria-label={`${deliverable.title} — deliverable thread`}>
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 pr-10">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight">
            {deliverable.title}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
            {/* The production status as the house pill (status-chip.tsx is
                the same `Chip` pattern): the whole state list with its colour
                dots — the current one checked, the machine's legal moves
                enabled, everything else dimmed. Read-only viewers get the
                plain dot line. */}
            {deliverable.viewerCanMove && targets.length > 0 ? (
              <Chip
                placeholder={meta.label}
                icon={
                  <span
                    aria-hidden
                    className={cn(
                      "size-2.5 rounded-full",
                      DELIVERABLE_DOTS[deliverable.status]
                    )}
                  />
                }
                label={meta.label}
              >
                <div className="flex flex-col gap-0.5">
                  {DELIVERABLE_STATUS_ORDER.map((value) => {
                    const legal = targets.includes(value)
                    return (
                      <ChipOption
                        key={value}
                        selected={value === deliverable.status}
                        disabled={busy || !legal}
                        onSelect={() =>
                          statusWrite.mutate({
                            deliverableId: deliverable.id,
                            status: value,
                          })
                        }
                        title={
                          legal
                            ? DELIVERABLE_META[value].label
                            : `${DELIVERABLE_META[value].label} — not a legal move from here`
                        }
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "size-2.5 shrink-0 rounded-full",
                            DELIVERABLE_DOTS[value]
                          )}
                        />
                      </ChipOption>
                    )
                  })}
                </div>
              </Chip>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className={cn(
                    "size-2.5 rounded-full",
                    DELIVERABLE_DOTS[deliverable.status]
                  )}
                />
                {meta.label}
              </span>
            )}
            {/* Owner and deadline as the same house pills: one click on the
                chip reaches the person list or the calendar — no manage menu.
                A viewer without the manage fact keeps the plain meta line. */}
            {canManage ? (
              <OwnerChip
                members={members}
                owner={deliverable.owner}
                onSelect={(teamId) => {
                  const member = members.find(
                    (candidate) => candidate.teamId === teamId
                  )
                  ownerWrite.mutate({
                    deliverableId: deliverable.id,
                    ownerId: teamId,
                    owner: member ? ownerRef(member) : null,
                  })
                }}
              />
            ) : deliverable.owner ? (
              <span className="inline-flex items-center gap-1.5">
                <TintedAvatar
                  seed={deliverable.owner.teamId}
                  name={deliverable.owner.name}
                  className="size-5"
                />
                {deliverable.owner.name ?? deliverable.owner.email ?? "Owner"}
              </span>
            ) : (
              <span>Unassigned</span>
            )}
            {canManage ? (
              <DateChip
                deadline={deliverable.deadline}
                placeholder="Add deadline"
                formatLabel={(deadline) =>
                  deliverable.overdue
                    ? `Overdue · ${formatDueDate(fromIsoDay(deadline))}`
                    : `due ${formatDueDate(fromIsoDay(deadline))}`
                }
                onChange={(deadline) =>
                  deadlineWrite.mutate({
                    deliverableId: deliverable.id,
                    deadline,
                  })
                }
                className={
                  deliverable.status !== "completed" &&
                  deliverable.deadline &&
                  dueSoon(deliverable.deadline)
                    ? "font-medium text-destructive"
                    : undefined
                }
              />
            ) : deliverable.deadline ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1.5",
                  deliverable.status !== "completed" &&
                    dueSoon(deliverable.deadline) &&
                    "font-medium text-destructive"
                )}
              >
                <CalendarDaysIcon aria-hidden className="size-3.5 shrink-0" />
                {deliverable.overdue ? "Overdue · " : "due "}
                {formatDueDate(deliverable.deadline)}
              </span>
            ) : null}
            {deliverable.type && (
              <MetaBadge className="bg-secondary font-medium text-secondary-foreground">
                <TagIcon aria-hidden className="size-3" />
                {deliverable.type}
              </MetaBadge>
            )}
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
          {deliverable.description && (
            <p className="mt-2 max-w-prose text-sm text-muted-foreground">
              {deliverable.description}
            </p>
          )}
          {error && (
            <p role="alert" className="mt-2 text-xs text-destructive">
              {error}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <ThreadModeToggle value={mode} onChange={onModeChange} />
        </div>
      </header>

      {/* The add-task affordance (FR-016): the same composer atom the
          loose-tasks bucket uses, pointed at this deliverable. Any project
          member can add work here and pick who carries it — themselves
          included — without waiting for the lead. */}
      {canWork && (
        <div className="mt-7">
          <TaskComposer
            workspaceId={workspaceId}
            projectId={projectId}
            deliverableId={deliverable.id}
            members={members}
            onCreated={onChanged}
          />
        </div>
      )}

      <ul className={canWork ? "mt-5" : "mt-7"}>
        <AnimatePresence initial={false}>
          {visibleTasks.map((task) => (
            <motion.li
              key={task.id}
              initial={false}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              style={{ overflow: "hidden" }}
            >
              <TaskThreadItem
                task={task}
                workspaceSlug={workspaceSlug}
                projectSlug={projectSlug}
              />
            </motion.li>
          ))}
        </AnimatePresence>
        {threadPending ? (
          <li>
            <ThreadLoading label="Loading conversation…" />
          </li>
        ) : threadError ? (
          <li>
            <ThreadError>
              {threadError instanceof Error
                ? threadError.message
                : "Could not load the conversation."}
            </ThreadError>
          </li>
        ) : (
          <>
            {messages.length === 0 && (
              <li>
                <ThreadEmpty>
                  No comments yet. Notes on this piece of work — the team reads
                  them right here.
                </ThreadEmpty>
              </li>
            )}
            {messages.map((message) => (
              <li key={message.id}>
                <ThreadRow message={message} />
              </li>
            ))}
          </>
        )}
      </ul>

      {canWork ? (
        <div className="mt-1">
          <ThreadComposer
            value={body}
            onChange={setBody}
            onSubmit={() => post.mutate(body.trim())}
            pending={post.isPending}
            placeholder={`Comment on ${deliverable.title}…`}
            label={`Add a comment to ${deliverable.title}`}
          />
          {serverPostError && <ThreadError>{serverPostError}</ThreadError>}
        </div>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">
          Only project members can add to this thread.
        </p>
      )}

      {/* The versions cluster: a flat drawer, deliberately not an accordion —
          every row opens its own detail level, nothing expands in place. */}
      <section aria-label={`Versions of ${deliverable.title}`} className="mt-8">
        <div className="rounded-xl bg-muted/30 p-2">
          <div className="flex items-center justify-between px-2 pt-1.5 pb-1">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Versions
            </h3>
            <span className="flex items-center gap-3 text-xs text-muted-foreground">
              {clusterTotal > 0 &&
                `${clusterTotal} ${clusterTotal === 1 ? "version" : "versions"}`}
              {/* The card's Library link (FR-041), ported: opens this
                  deliverable's files pre-filtered in the library. */}
              <Link
                to="/w/$workspaceSlug/library"
                params={{ workspaceSlug }}
                search={{ project: projectId, deliverable: deliverable.id }}
                className="underline-offset-2 hover:text-foreground hover:underline"
              >
                Library
              </Link>
              {/* New version from the cluster header, exactly where
                  versions-section put it — same viewer gate, and the
                  composer's props are the original ones. */}
              {versionsData?.viewer.canSubmit && (
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setComposerOpen(true)}
                >
                  <PlusIcon className="size-3.5" />
                  New version
                </Button>
              )}
            </span>
          </div>

          {composerOpen && (
            <div className="px-1 pt-1 pb-1">
              <VersionComposer
                workspaceId={workspaceId}
                projectId={projectId}
                deliverableId={deliverable.id}
                onSaved={() => {
                  setComposerOpen(false)
                  onVersionChanged()
                }}
                onCancel={() => setComposerOpen(false)}
              />
            </div>
          )}

          {versionsPending ? (
            <p className="px-2 pt-1 pb-2 text-xs text-muted-foreground">
              Loading versions…
            </p>
          ) : versionsError ? (
            <p role="alert" className="px-2 pt-1 pb-2 text-xs text-destructive">
              {versionsError instanceof Error
                ? versionsError.message
                : "Could not load versions."}
            </p>
          ) : clusterTotal === 0 ? (
            <p className="px-2 pt-1 pb-2 text-xs text-muted-foreground">
              {versionsData?.viewer.canSubmit
                ? "No files on this deliverable yet. Submit the first version — a link to the file, or an upload."
                : "No files on this deliverable yet — its owner or the project lead will submit the first version."}
            </p>
          ) : (
            <ul className="flex flex-col">
              {(versionsData?.assets ?? []).flatMap((asset) =>
                asset.versions.map((version) => {
                  const reviewMeta = version.reviewStatus
                    ? {
                        label: REVIEW_STATUS_META[version.reviewStatus].label,
                        dot: REVIEW_DOTS[version.reviewStatus],
                        badgeClass:
                          REVIEW_STATUS_META[version.reviewStatus].badgeClass,
                      }
                    : DRAFT_REVIEW_META
                  return (
                    <li key={version.id}>
                      <button
                        type="button"
                        aria-label={[
                          `Version ${version.label} of ${asset.filename}`,
                          reviewMeta.label,
                          version.feedbackCount > 0
                            ? `${version.feedbackCount} notes of feedback`
                            : null,
                          version.isLatest ? "latest" : null,
                          version.isLatestApproved ? "latest approved" : null,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                        onClick={() =>
                          onOpenVersion({
                            version,
                            assetId: asset.id,
                            assetFilename: asset.filename,
                          })
                        }
                        className="group flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        <span className="font-mono text-xs text-muted-foreground">
                          {version.label}
                        </span>
                        {version.isLatest && (
                          <MetaBadge className="bg-secondary text-secondary-foreground">
                            Latest
                          </MetaBadge>
                        )}
                        {version.isLatestApproved && (
                          <MetaBadge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                            Latest approved
                          </MetaBadge>
                        )}
                        <span className="min-w-0 flex-1 truncate text-sm">
                          {asset.filename}
                        </span>
                        <MetaBadge className={reviewMeta.badgeClass}>
                          <span
                            aria-hidden
                            className={cn(
                              "size-2 shrink-0 rounded-full",
                              reviewMeta.dot
                            )}
                          />
                          {reviewMeta.label}
                        </MetaBadge>
                        <span className="hidden shrink-0 text-[11px] text-muted-foreground sm:block">
                          {version.submitter.name ??
                            version.submitter.email ??
                            "Former member"}{" "}
                          · {formatRelativeTime(version.createdAt)}
                        </span>
                        {version.feedbackCount > 0 && (
                          <MetaBadge>
                            {version.feedbackCount}{" "}
                            {version.feedbackCount === 1 ? "note" : "notes"}
                          </MetaBadge>
                        )}
                        <ChevronRightIcon
                          aria-hidden
                          className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity duration-150 group-hover:opacity-70 group-focus-visible:opacity-70"
                        />
                      </button>
                    </li>
                  )
                })
              )}
            </ul>
          )}
        </div>
      </section>
    </section>
  )
}

/* ------------------------------- level two -------------------------------- */

/**
 * One version, the shape of the concept's level two: the ‹ vN of N › pager,
 * the asset info versions-section rendered, the decisions it offered, and
 * its feedback thread (the existing `VersionThread`, embedded as-is).
 * Action gates are the exact viewer facts versions-section stamped.
 */
function LevelTwo({
  workspaceId,
  projectId,
  deliverable,
  rows,
  row,
  canSubmit,
  canDecide,
  onChanged,
  onBack,
  onPaginate,
}: {
  workspaceId: string
  projectId: string
  deliverable: DeliverableCard
  /** All flat rows of the timeline, for the pager's index. */
  rows: CabinetVersionRow[]
  row: CabinetVersionRow
  /** Same gates versions-section received from the timeline's viewer. */
  canSubmit: boolean
  canDecide: boolean
  /** The cabinet's version refresh — the section's `refresh` role. */
  onChanged: () => void
  onBack: () => void
  onPaginate: (delta: 1 | -1) => void
}) {
  const version = row.version
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [decideKind, setDecideKind] = useState<DecisionKind | null>(null)

  // The pager walks this version's own asset: paging across unrelated files
  // would swap the filename under the reader, which is never the verb they
  // clicked ("next version", not "next file").
  const pagerRows = rows.filter((current) => current.assetId === row.assetId)
  const index = pagerRows.findIndex(
    (current) => current.version.id === version.id
  )

  const reviewMeta = version.reviewStatus
    ? {
        label: REVIEW_STATUS_META[version.reviewStatus].label,
        dot: REVIEW_DOTS[version.reviewStatus],
        badgeClass: REVIEW_STATUS_META[version.reviewStatus].badgeClass,
      }
    : DRAFT_REVIEW_META

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
    <section aria-label={`Version ${version.label} of ${row.assetFilename}`}>
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
            {row.assetFilename}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
            <MetaBadge className={reviewMeta.badgeClass}>
              <span
                aria-hidden
                className={cn("size-2 shrink-0 rounded-full", reviewMeta.dot)}
              />
              {reviewMeta.label}
            </MetaBadge>
            {/* The supersession notes the service stamps: where this
                version stands in its asset's history (FR-037). */}
            {version.isLatest && (
              <MetaBadge className="bg-secondary text-secondary-foreground">
                Latest
              </MetaBadge>
            )}
            {version.isLatestApproved && (
              <MetaBadge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                Latest approved
              </MetaBadge>
            )}
            <span>
              {version.source === "external_link"
                ? `External link${
                    version.externalProvider
                      ? ` (${version.externalProvider})`
                      : ""
                  }`
                : "Hosted upload"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <NeutralAvatar name={version.submitter.name} className="size-5" />
              {version.submitter.name ??
                version.submitter.email ??
                "Former member"}
              {version.submittedAt &&
                ` · submitted ${formatRelativeTime(version.submittedAt)}`}
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
                  "mt-1 size-2.5 shrink-0 rounded-full",
                  REVIEW_DOTS[version.decision.decision]
                )}
              />
              <div className="min-w-0">
                <p className="text-xs font-medium">
                  {REVIEW_STATUS_META[version.decision.decision].label} by{" "}
                  {version.decision.approverName ??
                    version.decision.approverEmail ??
                    "a former member"}
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    · {formatRelativeTime(version.decision.decidedAt)}
                  </span>
                </p>
              </div>
            </div>
          )}

          {/* The asset's own facts, versions-section's words. */}
          <p className="mt-3 max-w-prose text-xs text-muted-foreground">
            {version.source === "external_link" ? (
              <>
                <LinkIcon aria-hidden className="mr-1 inline size-3" />
                External link
                {version.externalProvider
                  ? ` (${version.externalProvider})`
                  : ""}{" "}
                —{" "}
                <a
                  href={version.url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-foreground"
                >
                  open file
                </a>
                . Antara cannot detect changes to a linked file.
              </>
            ) : (
              <>
                {version.mimeType ?? "file"}
                {version.sizeBytes !== null
                  ? ` · ${formatBytes(version.sizeBytes)}`
                  : ""}{" "}
                — hosted upload
              </>
            )}
          </p>

          {error && (
            <p role="alert" className="mt-2 text-xs text-destructive">
              {error}
            </p>
          )}

          {/* Action row, ported from versions-section.tsx — gates and fns
              identical, only the chrome is the concept's. */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {version.reviewStatus === null && canSubmit && (
              <>
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    void run(() =>
                      submitForReviewFn({
                        data: { workspaceId, projectId, versionId: version.id },
                      })
                    )
                  }
                >
                  Send for review
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  aria-label="Delete this draft"
                  onClick={() =>
                    void run(() =>
                      deleteDraftVersionFn({
                        data: { workspaceId, projectId, versionId: version.id },
                      })
                    )
                  }
                  title={
                    "Removes the draft. A submitted version is history — supersede it instead."
                  }
                >
                  <Trash2Icon className="size-4" />
                  Delete draft
                </Button>
              </>
            )}

            {version.reviewStatus === "submitted" && canDecide && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" disabled={busy}>
                    Decide…
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {(Object.keys(DECISION_META) as DecisionKind[]).map(
                    (kind) => (
                      <DropdownMenuItem
                        key={kind}
                        onClick={() => setDecideKind(kind)}
                      >
                        {DECISION_META[kind].label}
                      </DropdownMenuItem>
                    )
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        <VersionPager rows={pagerRows} index={index} onPaginate={onPaginate} />
      </div>

      <div className="mt-6 flex flex-col gap-1">
        <VersionThread
          workspaceId={workspaceId}
          projectId={projectId}
          versionId={version.id}
          onChanged={onChanged}
        />
      </div>

      {decideKind && (
        <DecideDialog
          kind={decideKind}
          busy={busy}
          onClose={() => setDecideKind(null)}
          onConfirm={(comment) => {
            void run(() =>
              decideVersionFn({
                data: {
                  workspaceId,
                  projectId,
                  versionId: version.id,
                  decision: decideKind,
                  comment: comment.length > 0 ? comment : undefined,
                },
              })
            ).then(() => setDecideKind(null))
          }}
        />
      )}
    </section>
  )
}

/* ------------------------------- fragments -------------------------------- */

/** The ‹ › version pager, ported from the concept. ‹ walks to an older
 *  version, › to a newer one; the current label and the count sit between. */
function VersionPager({
  rows,
  index,
  onPaginate,
}: {
  rows: CabinetVersionRow[]
  index: number
  onPaginate: (delta: 1 | -1) => void
}) {
  const current = rows.at(index)
  const older = rows.at(index + 1)
  const newer = rows.at(index - 1)

  return (
    <div
      role="group"
      aria-label="Version pager"
      className="flex shrink-0 items-center gap-0.5 rounded-lg bg-muted/40 p-1"
    >
      <button
        type="button"
        disabled={!older}
        aria-label={
          older ? `Older version (${older.version.label})` : "Oldest version"
        }
        onClick={() => onPaginate(1)}
        className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-40"
      >
        <ChevronLeftIcon aria-hidden className="size-3.5" />
      </button>
      <span className="flex items-baseline gap-1 rounded-md bg-background px-2.5 py-1 shadow-xs">
        <span className="font-mono text-xs text-foreground">
          {current?.version.label ?? "—"}
        </span>
        <span className="text-xs text-muted-foreground">of {rows.length}</span>
      </span>
      <button
        type="button"
        disabled={!newer}
        aria-label={
          newer ? `Newer version (${newer.version.label})` : "Newest version"
        }
        onClick={() => onPaginate(-1)}
        className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-40"
      >
        <ChevronRightIcon aria-hidden className="size-3.5" />
      </button>
    </div>
  )
}

/** An open task as a thread node: assignee faces at the head, status,
 *  priority and due in a quiet second row, into the task's own page. */
function TaskThreadItem({
  task,
  workspaceSlug,
  projectSlug,
}: {
  task: TaskCard
  workspaceSlug: string
  projectSlug: string | undefined
}) {
  return (
    <div className="flex gap-3.5 pb-5">
      <span aria-hidden className="w-px shrink-0 bg-border" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {task.assignees.length > 0 && (
            <span className="flex items-center gap-1">
              {task.assignees.map((assignee) => (
                <TintedAvatar
                  key={assignee.projectMemberId}
                  seed={assignee.projectMemberId}
                  name={assignee.name}
                  className="size-5"
                />
              ))}
            </span>
          )}
          {projectSlug !== undefined ? (
            <Link
              to="/w/$workspaceSlug/projects/$projectSlug/tasks/$taskId"
              params={{ workspaceSlug, projectSlug, taskId: task.id }}
              className="text-sm font-medium hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {task.title}
            </Link>
          ) : (
            <span className="text-sm font-medium">{task.title}</span>
          )}
          {/* What the node is, on the right — in All mode it sits beside
              comment rows, and the badge is the only word that says so. */}
          <span className="ml-auto rounded-full bg-muted/70 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            Task
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <Dot
            dot={TASK_DOTS[task.status]}
            label={TASK_STATUS_META[task.status].label}
          />
          {/* Medium priority is the room tone: only deviations get text. */}
          {task.priority !== "medium" && (
            <span>{TASK_PRIORITY_META[task.priority].label}</span>
          )}
          {task.dueDate && (
            <span
              className={cn(
                "inline-flex items-center gap-1",
                task.status !== "done" &&
                  task.status !== "approved" &&
                  task.dueDate &&
                  dueSoon(task.dueDate) &&
                  "font-medium text-destructive"
              )}
            >
              <CalendarDaysIcon aria-hidden className="size-3.5 shrink-0" />
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

/** The All / Comments-only control, ported from the concept — framer's
 *  layoutId keeps the pill glued to whichever segment is active. */
function ThreadModeToggle({
  value,
  onChange,
}: {
  value: "all" | "comments"
  onChange: (value: "all" | "comments") => void
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
                layoutId="deliverables-cabinet-mode-pill"
                initial={false}
                className="absolute inset-0 rounded-md bg-background shadow-xs"
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              />
            )}
            <span className="relative">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}

/** 10px filled dot + plain label — the colour of a chip, without the box. */
function Dot({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className={cn("size-2.5 shrink-0 rounded-full", dot)} />
      {label}
    </span>
  )
}

/** The cabinet's quiet pill (the "Task" badge's sibling): one rounded wash,
 *  small medium text. Everything the reader should scan as a fact wears
 *  one — the deliverable's tag, a version's stream badges, note counts. */
function MetaBadge({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
        // The empty-tone default: quiet meta, never a colour claim.
        className ?? "bg-muted/70 text-muted-foreground"
      )}
    >
      {children}
    </span>
  )
}

/** Tinted initials avatar, tinted by a stable id — the same derivation the
 *  concept used (`avatarTint`). Always aria-hidden — everywhere it appears,
 *  the person's name is beside it or in the row's aria-label. */
function TintedAvatar({
  seed,
  name,
  className,
}: {
  seed: string
  name: string | null
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
        className,
        avatarTint(seed)
      )}
    >
      {(name?.trim()[0] ?? "?").toUpperCase()}
    </span>
  )
}

/** Neutral initials avatar for people the lane knows without a stable id —
 *  the concept's `NameAvatar` slot for submitters and the like. */
function NeutralAvatar({
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
      {(name?.trim()[0] ?? "?").toUpperCase()}
    </span>
  )
}

/** The decision dialog, ported from versions-section.tsx, logic identical. */
function DecideDialog({
  kind,
  busy,
  onClose,
  onConfirm,
}: {
  kind: DecisionKind
  busy: boolean
  onClose: () => void
  onConfirm: (comment: string) => void
}) {
  const [comment, setComment] = useState("")
  const meta = DECISION_META[kind]

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{meta.label}</DialogTitle>
          <DialogDescription>{meta.description}</DialogDescription>
        </DialogHeader>
        <Textarea
          aria-label="Decision note (optional)"
          rows={3}
          placeholder={
            kind === "changes_requested"
              ? "What should change? (optional)"
              : "Add a note with this decision (optional)"
          }
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          maxLength={2000}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy} onClick={() => onConfirm(comment.trim())}>
            {meta.label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
