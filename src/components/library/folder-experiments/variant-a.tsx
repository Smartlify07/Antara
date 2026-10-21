import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { XIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { ProjectCoverArt } from "@/components/workspace/project-cover-art"
import {
  APPROVAL_META,
  BOOK_INK,
  BOOK_INK_SOFT,
  MOCK_FOLDERS,
  REVIEW_DOTS,
  assetBookColor,
  folderAccent,
  formatFullDate,
  formatRelative,
  initialsOf,
  sourceLabel,
  tintOf,
} from "@/components/library/folder-experiments/mock"
import type {
  MockAsset,
  MockFolder,
} from "@/components/library/folder-experiments/mock"

/**
 * Variant A — "Cut pocket + standing covers" (tactile paper, print studio).
 *
 * The index is a grid of die-cut folder cutouts: a back board washed with
 * the project's accent + grain, a rounded-top tab carrying the title, a
 * near-white front pocket, and asset titles peeking out of the pocket as
 * paper strips in each asset's book colour. A cutout opens the shelf, where
 * every asset stands up as a portrait cover; expanding a cover lifts and
 * tilts it away, revealing the record sheet beneath, inside the same cell.
 *
 * Mock data only (see ./mock) — nothing here touches the server. House
 * bans honoured: no borders, no spinners; colour arrives through the mock
 * helpers and semantic tokens, structure through washes, shadows and tone.
 */

/* ------------------------------ shared bits ------------------------------ */

/** The repo's standard ease-out curve (same family projects-grid uses). */
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

/** "docs.google.com" — the quiet domain line under a link row. */
function domainOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

function countOf(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`
}

/** The meta line both screens repeat: count and last activity. */
function folderMetaLine(folder: MockFolder): string {
  return `${countOf(folder.assets.length, "asset", "assets")} · last activity ${formatRelative(folder.updatedAt)}`
}

/* ------------------------- Screen 1 · folder cutouts ---------------------- */

/** Horizontal/rotational stagger for the messy paper strip stack. */
const STRIP_STAGGER = ["ml-0.5", "ml-4", "ml-1"] as const
const STRIP_TILT = [
  "rotate-[-1deg]",
  "rotate-[0.75deg]",
  "rotate-[-0.5deg]",
] as const

/**
 * One die-cut folder silhouette. The button is the whole cutout; the strips
 * and pocket note are hidden from assistive tech because the button's own
 * label carries the same facts cleanly.
 */
function FolderCutout({
  folder,
  onOpen,
}: {
  folder: MockFolder
  onOpen: (slug: string) => void
}) {
  const accent = folderAccent(folder.slug)
  const peek = folder.assets.slice(0, 3)
  const overflow = folder.assets.length - peek.length

  return (
    <div>
      <button
        type="button"
        onClick={() => onOpen(folder.slug)}
        aria-label={`Open the ${folder.title} folder, ${countOf(folder.assets.length, "asset", "assets")}`}
        className="group block w-full rounded-2xl text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
      >
        <div className="relative h-60">
          {/* Back board: the projects-grid accent wash, with grain. */}
          <ProjectCoverArt
            seed={folder.slug}
            gradient={{ start: accent, end: null }}
            className="absolute inset-x-0 top-6 bottom-0 rounded-2xl"
          />

          {/* Die-cut tab: part of the back board, carries the title. */}
          <div
            aria-hidden
            className="absolute top-0 left-6 h-7 w-[62%] overflow-hidden rounded-t-2xl shadow-xs"
            style={{ backgroundColor: accent }}
          >
            <div className="absolute inset-0 bg-foreground/10" />
            <span
              className="absolute inset-0 flex items-center px-3 text-xs font-medium tracking-tight"
              style={{ color: BOOK_INK }}
            >
              <span className="truncate">{folder.title}</span>
            </span>
          </div>

          {/* Paper strips: the first asset titles peek out of the pocket. */}
          <div
            aria-hidden
            className="absolute right-10 bottom-[55%] left-6 flex flex-col items-start gap-1"
          >
            {peek.map((asset, i) => (
              <span
                key={asset.id}
                className={cn(
                  "inline-flex h-6 max-w-full items-center overflow-hidden rounded-md px-2.5 shadow-sm transition-transform duration-300 ease-out group-hover:-translate-y-0.5",
                  STRIP_STAGGER[i],
                  STRIP_TILT[i]
                )}
                style={{
                  backgroundColor: assetBookColor(asset.id),
                  color: BOOK_INK,
                  transitionDelay: `${i * 50}ms`,
                }}
              >
                <span className="truncate text-[11px] font-medium">
                  {asset.filename}
                </span>
              </span>
            ))}
          </div>

          {/* Front pocket: near-white, covering the lower two-thirds. */}
          <div
            aria-hidden
            className="absolute inset-x-2.5 top-[40%] bottom-2.5 rounded-t-2xl rounded-b-md bg-card shadow-md transition-shadow duration-300 group-hover:shadow-lg"
          />

          {/* Overload note, sitting on the pocket's top edge. */}
          {overflow > 0 && (
            <span
              aria-hidden
              className="absolute top-[43%] left-[36px] text-[11px] text-muted-foreground"
            >
              +{overflow} more…
            </span>
          )}

          {/* A folder can be empty and still read as one. */}
          {folder.assets.length === 0 && (
            <span className="absolute inset-x-0 top-[58%] text-center text-xs text-muted-foreground">
              No files yet
            </span>
          )}
        </div>
      </button>

      <p className="mt-3 text-xs text-muted-foreground">
        {folderMetaLine(folder)}
      </p>
    </div>
  )
}

/** Screen 1 — the library index: every folder in the workspace. */
export function LibraryFoldersIndex({
  onOpen,
}: {
  onOpen: (slug: string) => void
}) {
  return (
    <section aria-label="Library folders">
      <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
        {MOCK_FOLDERS.map((folder) => (
          <FolderCutout key={folder.id} folder={folder} onOpen={onOpen} />
        ))}
      </div>
    </section>
  )
}

/* -------------------------- Screen 2 · standing covers -------------------- */

/**
 * One book: a standing portrait cover in the asset's book colour. The
 * page-block thickness is suggested by two lighter same-hue layers on the
 * right edge. Expanding lifts and tilts the cover away, revealing the
 * detail sheet beneath, inside the same grid cell.
 */
function ShelfBook({
  asset,
  expanded,
  onToggle,
}: {
  asset: MockAsset
  expanded: boolean
  onToggle: () => void
}) {
  const reduce = useReducedMotion()
  const book = assetBookColor(asset.id)
  const approval = APPROVAL_META[asset.approvalState]

  const coverRest = { rotateX: 0, y: 0, scale: 1, opacity: 1 }
  const coverLift = reduce
    ? { rotateX: 0, y: 0, scale: 1, opacity: 0 }
    : { rotateX: 18, y: -10, scale: 0.96, opacity: 0.3 }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={`asset-sheet-${asset.id}`}
        aria-label={
          expanded
            ? `Hide the details for ${asset.filename}`
            : `Open the details for ${asset.filename}`
        }
        className={cn(
          "block w-full rounded-xl text-left transition-transform duration-200 ease-out focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none",
          !expanded && "hover:-translate-y-0.5"
        )}
        style={{ perspective: 1100 }}
      >
        <motion.div
          className="relative aspect-[3/4] origin-bottom"
          animate={expanded ? coverLift : coverRest}
          transition={{ duration: 0.32, ease: EASE }}
        >
          {/* Page-block thickness: lighter same-hue layers on the right. */}
          <div
            aria-hidden
            className="absolute inset-y-1 -right-1.5 rounded-r-md"
            style={{ backgroundColor: book }}
          >
            <div
              className="size-full rounded-[inherit]"
              style={{ backgroundColor: BOOK_INK_SOFT, opacity: 0.4 }}
            />
          </div>
          <div
            aria-hidden
            className="absolute inset-y-2 -right-3 rounded-r-md"
            style={{ backgroundColor: book }}
          >
            <div
              className="size-full rounded-[inherit]"
              style={{ backgroundColor: BOOK_INK_SOFT, opacity: 0.65 }}
            />
          </div>

          {/* The face: book colour wearing the cover-language grain. */}
          <ProjectCoverArt
            seed={asset.id}
            gradient={{ start: book, end: null }}
            className="absolute inset-0 rounded-xl shadow-sm"
          />
          <div className="absolute inset-0 flex flex-col justify-between rounded-xl p-4">
            <p
              className="line-clamp-4 text-[15px] leading-snug font-medium break-all"
              style={{ color: BOOK_INK }}
            >
              {asset.filename}
            </p>
            <p
              className="flex items-center gap-1.5 text-[11px]"
              style={{ color: BOOK_INK_SOFT }}
            >
              <span
                aria-hidden
                className={cn("size-2 shrink-0 rounded-full", approval.dot)}
              />
              <span className="truncate">{asset.assetType ?? "File"}</span>
            </p>
          </div>
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {expanded ? <BookSheet asset={asset} onClose={onToggle} /> : null}
      </AnimatePresence>
    </div>
  )
}

/**
 * The record beneath the lifted cover. Left column: the facts — who created
 * it and when, the latest version with its review dot, the last ever
 * approved version, the version count and the whole-history approval state.
 * Right column: the working link and the reserved artwork zone.
 */
function BookSheet({
  asset,
  onClose,
}: {
  asset: MockAsset
  onClose: () => void
}) {
  const reduce = useReducedMotion()
  const latest = asset.latestVersion
  const latestReview = latest?.reviewStatus
    ? REVIEW_DOTS[latest.reviewStatus]
    : null
  const approval = APPROVAL_META[asset.approvalState]

  return (
    <motion.div
      role="region"
      aria-label={`${asset.filename} details`}
      id={`asset-sheet-${asset.id}`}
      className="absolute inset-x-0 top-0 z-30 flex min-h-full flex-col rounded-xl bg-card p-4 shadow-xl"
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.97 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.98 }}
      transition={{ duration: 0.28, ease: EASE }}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-medium tracking-tight break-all">
          {asset.filename}
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label={`Close the details for ${asset.filename}`}
          className="mt-0.5 shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <XIcon className="size-3.5" aria-hidden />
        </button>
      </div>

      <div className="grid flex-1 grid-cols-2 gap-x-3 gap-y-3 pt-2">
        <div className="flex flex-col gap-2.5">
          <div>
            <p className="text-[11px] text-muted-foreground">Created by</p>
            <p className="mt-1 flex items-center gap-1.5">
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                  tintOf(asset.createdBy)
                )}
              >
                {initialsOf(asset.createdBy.name)}
              </span>
              <span className="text-xs font-medium">
                {asset.createdBy.name}
              </span>
            </p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Created</p>
            <p className="mt-1 text-xs">{formatFullDate(asset.createdAt)}</p>
          </div>
          <div className="flex flex-col gap-1.5 pt-1">
            {latest ? (
              <p className="flex items-center gap-1.5 text-xs">
                <span className="font-medium">{latest.label}</span>
                {latestReview ? (
                  <>
                    <span
                      aria-hidden
                      className={cn(
                        "size-2 shrink-0 rounded-full",
                        latestReview.dot
                      )}
                    />
                    <span className="text-muted-foreground">
                      {latestReview.label}
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground">draft</span>
                )}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                No versions recorded
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {asset.latestApprovedLabel
                ? `Latest approved ${asset.latestApprovedLabel}`
                : "Nothing approved yet"}
            </p>
            <p className="text-xs text-muted-foreground">
              {countOf(asset.versionCount, "version", "versions")}
            </p>
            <p className="flex items-center gap-1.5 text-xs">
              <span
                aria-hidden
                className={cn("size-2 shrink-0 rounded-full", approval.dot)}
              />
              {approval.label}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <p className="text-[11px] text-muted-foreground">The file</p>
            {latest ? (
              <>
                <p className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {sourceLabel(latest)}
                  </span>
                </p>
                <a
                  href={latest.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1.5 block rounded-lg bg-muted/60 px-2.5 py-2 transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <span className="block truncate text-xs font-medium">
                    {domainOf(latest.url)}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    Open {sourceLabel(latest)}
                  </span>
                </a>
              </>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                No versions recorded.
              </p>
            )}
          </div>
          <div className="min-h-24 flex-1 rounded-lg bg-muted/50 p-3">
            <p className="text-[11px] font-medium text-muted-foreground">
              Artwork arriving
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground/70">
              Reserved for imagery — nothing is drawn here yet.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

/** Screen 2 — the folder shelf: its assets stood up as covers. */
export function LibraryFoldersShelf({
  folder,
  onBack,
}: {
  folder: MockFolder
  onBack: () => void
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const backRef = useRef<HTMLButtonElement>(null)

  // The page change lands focus on the back affordance, the way a real
  // navigation would move focus to the new heading region.
  useEffect(() => {
    backRef.current?.focus()
  }, [])

  // Escape closes any open book, whichever cell holds focus.
  useEffect(() => {
    if (!expandedId) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpandedId(null)
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [expandedId])

  return (
    <section aria-label={`Folder: ${folder.title}`}>
      <header className="flex flex-col gap-4">
        <button
          ref={backRef}
          type="button"
          onClick={onBack}
          className="w-fit rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {"← All folders"}
        </button>
        <div className="flex items-center gap-3">
          <ProjectCoverArt
            seed={folder.slug}
            gradient={{ start: folderAccent(folder.slug), end: null }}
            className="h-7 w-11 shrink-0 rounded-lg"
          />
          <div className="min-w-0">
            <h2 className="text-2xl font-medium tracking-tighter">
              {folder.title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {folderMetaLine(folder)}
            </p>
          </div>
        </div>
      </header>

      {folder.assets.length === 0 ? (
        <p className="mt-10 text-sm text-muted-foreground">No files yet.</p>
      ) : (
        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {folder.assets.map((asset) => (
            <ShelfBook
              key={asset.id}
              asset={asset}
              expanded={expandedId === asset.id}
              onToggle={() =>
                setExpandedId((current) =>
                  current === asset.id ? null : asset.id
                )
              }
            />
          ))}
        </div>
      )}
    </section>
  )
}

/* ------------------------------- the demo -------------------------------- */

/**
 * Holds the index ⇄ shelf screen state and demos the page change with a
 * crossfade/slide (softened for prefers-reduced-motion).
 */
export default function LibraryFoldersA() {
  const reduce = useReducedMotion()
  const [openSlug, setOpenSlug] = useState<string | null>(null)
  const folder = openSlug
    ? (MOCK_FOLDERS.find((f) => f.slug === openSlug) ?? null)
    : null

  // A page change resets the reading position — the next screen opens at
  // its top, whether it is the shelf or the index again.
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [openSlug])

  const screenMotion = {
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 16 },
    animate: reduce ? { opacity: 1 } : { opacity: 1, y: 0 },
    exit: reduce ? { opacity: 0 } : { opacity: 0, y: -12 },
    transition: { duration: 0.3, ease: EASE },
  } as const

  return (
    <AnimatePresence mode="wait" initial={false}>
      {folder ? (
        <motion.div key={`shelf-${folder.slug}`} {...screenMotion}>
          <LibraryFoldersShelf
            folder={folder}
            onBack={() => setOpenSlug(null)}
          />
        </motion.div>
      ) : (
        <motion.div key="index" {...screenMotion}>
          <LibraryFoldersIndex onOpen={setOpenSlug} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
