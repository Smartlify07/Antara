import { useState } from "react"
import { Link } from "@tanstack/react-router"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { ArrowUpRightIcon, XIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatRelativeTime } from "@/lib/time"
import {
  ProjectCoverArt,
  projectCoverColor,
} from "@/components/workspace/project-cover-art"
import type { LibraryFolder } from "./folder-grouping"
import { setLibraryFolderScope } from "./folder-scope"
import { ASSET_STATE_META } from "./library-meta"
import type {
  LibraryAssetSummary,
  LibraryPerson,
  LibraryVersionSummary,
} from "@/server/services/library-service"
import type { VersionReviewStatus } from "@/db/enums"

/**
 * The Library's folder presentation (FR-039..044) — variant A of the
 * folder-cutout concept sprint, graduated onto the real lane payloads.
 *
 * The unfiltered library is a wall of die-cut folder cutouts, one per
 * project: a back board washed with the project's own accent and grain, a
 * rounded-top tab carrying the title, a near-white front pocket, and asset
 * titles peeking out of the pocket as paper strips in each asset's book
 * colour. A cutout is a link whose click carries the folder's scope in
 * memory (see `folder-scope`) — opening a folder is a plain navigation to
 * the library route that paints the shelf the same tick, because the wall's
 * rows already hold it. The scope is never written to the address bar: the
 * URL filters stay the deep-link contract, and a hand-typed `?project=…`
 * lands on the same shelf.
 *
 * Inside a folder every asset stands up as a portrait cover; expanding a
 * cover lifts and tilts it away, revealing the record sheet in the same
 * cell: who created it and when, where the file lives, the working link,
 * and the whole version history newest first, earlier rows behind an inline
 * toggle. The timeline rides the list payload itself (see `library-service`
 * — the rows were already fetched for the flags), so an opened book costs
 * no second fetch.
 *
 * House bans honoured: no borders, no spinners; colour arrives through the
 * persisted project accents and semantic tokens, structure through washes,
 * shadows and tone.
 */

/** History rows shown before an inline toggle offers the earlier ones. */
const HISTORY_PREVIEW_COUNT = 4

/** The repo's standard ease-out curve (same family projects-grid uses). */
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

/* ------------------------------- palette -------------------------------- */

function hash(value: string): number {
  let h = 2166136261
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/**
 * Book colours — one notch deeper than the project band, so near-white ink
 * reads comfortably on any of them and a shelf of books never competes with
 * the project-coloured folders behind it.
 */
const BOOK_COLORS = [
  "oklch(0.62 0.17 350)", // pink
  "oklch(0.64 0.15 25)", // coral
  "oklch(0.68 0.15 70)", // amber
  "oklch(0.68 0.14 130)", // lime
  "oklch(0.62 0.14 165)", // teal
  "oklch(0.58 0.13 250)", // blue
  "oklch(0.60 0.15 300)", // violet
  "oklch(0.62 0.16 15)", // red
]

/** The book's own background colour, stable per asset id. */
function bookColorOf(assetId: string): string {
  return BOOK_COLORS[hash(assetId) % BOOK_COLORS.length]
}

/** Near-white ink that holds on every book colour. */
const BOOK_INK = "oklch(0.97 0.005 260)"

/** The same ink at rest — for meta lines and quiet corners of a book face. */
const BOOK_INK_SOFT = "oklch(0.90 0.01 260)"

/** A dark scrim behind the tap/click hint pill, readable on any book colour. */
const BOOK_SCRIM = "oklch(0.15 0.01 260 / 0.55)"

/** Per-version review dots, mirroring the version lane's chip families. */
const REVIEW_DOTS: Record<
  VersionReviewStatus,
  { label: string; dot: string }
> = {
  submitted: { label: "In review", dot: "bg-blue-500" },
  approved: { label: "Approved", dot: "bg-emerald-500" },
  rejected: { label: "Rejected", dot: "bg-red-500" },
  changes_requested: { label: "Changes requested", dot: "bg-amber-500" },
  superseded: { label: "Superseded", dot: "bg-muted-foreground/40" },
}

/* --------------------------------- text --------------------------------- */

function countOf(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`
}

/** "docs.google.com" — the quiet domain a link row leads with. */
function domainOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

/** How the file arrived — the link row's leading label. */
function sourceLabel(version: LibraryVersionSummary): string {
  if (version.source === "external_link") {
    return version.externalProvider
      ? `${version.externalProvider} link`
      : "External link"
  }
  return "Hosted upload"
}

/** "12 Mar 2026" — the sheet's created date. Absolute on purpose: it can
 *  never flip between server and client the way a relative stamp can. */
const FULL_DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
})

function formatFullDate(date: Date | string): string {
  return FULL_DATE.format(new Date(date))
}

/** Stable avatar tints for a person, from the house tint pool. */
const TINT_POOL = [
  "bg-rose-100 text-rose-700",
  "bg-orange-100 text-orange-700",
  "bg-amber-100 text-amber-700",
  "bg-lime-100 text-lime-700",
  "bg-emerald-100 text-emerald-700",
  "bg-teal-100 text-teal-700",
  "bg-sky-100 text-sky-700",
  "bg-indigo-100 text-indigo-700",
  "bg-violet-100 text-violet-700",
  "bg-fuchsia-100 text-fuchsia-700",
]

function initialsOf(person: LibraryPerson): string {
  const first = person.name?.trim()[0] ?? person.email?.trim()[0]
  return first ? first.toUpperCase() : "?"
}

function tintOf(person: LibraryPerson): string {
  const key = person.email ?? person.name ?? ""
  return TINT_POOL[hash(key) % TINT_POOL.length]
}

/** The cutout and scoped-header meta line: count and last activity. */
export function folderMetaLine(folder: LibraryFolder): string {
  const base = countOf(folder.assets.length, "asset", "assets")
  return folder.lastActivity
    ? `${base} · last activity ${formatRelativeTime(folder.lastActivity)}`
    : base
}

/* ------------------------- Screen 1 · folder cutouts --------------------- */

/** Horizontal/rotational stagger for the messy paper strip stack. */
const STRIP_STAGGER = ["ml-0.5", "ml-4", "ml-1"] as const
const STRIP_TILT = [
  "rotate-[-1deg]",
  "rotate-[0.75deg]",
  "rotate-[-0.5deg]",
] as const

/**
 * One die-cut folder silhouette. The whole cutout is the link; the strips
 * and pocket note are presentation only — the link's accessible name
 * carries the facts cleanly.
 */
function FolderCutout({
  workspaceSlug,
  folder,
  onSeedScope,
}: {
  workspaceSlug: string
  folder: LibraryFolder
  onSeedScope?: (folderId: string) => void
}) {
  const band = projectCoverColor(folder.slug, {
    start: folder.gradientStart,
    end: folder.gradientEnd,
  })
  const peek = folder.assets.slice(0, 3)
  const overflow = Math.max(0, folder.assets.length - peek.length)

  return (
    <div>
      <Link
        to="/w/$workspaceSlug/library"
        params={{ workspaceSlug }}
        onClick={() => {
          setLibraryFolderScope(workspaceSlug, folder.id)
          // The shelf's first paint rides these rows (see the index route's
          // `seedScopedShelf`); the scoped fetch answers behind it.
          onSeedScope?.(folder.id)
        }}
        aria-label={`Open the ${folder.title} folder, ${countOf(folder.assets.length, "asset", "assets")}`}
        className="group block w-full rounded-2xl text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
      >
        <div className="relative h-60">
          {/* Back board: the project's own cover wash, with grain. */}
          <ProjectCoverArt
            seed={folder.slug}
            gradient={{ start: folder.gradientStart, end: folder.gradientEnd }}
            className="absolute inset-x-0 top-6 bottom-0 rounded-2xl"
          />

          {/* Die-cut tab: part of the back board, carries the title. */}
          <div
            aria-hidden
            className="absolute top-0 left-6 h-7 w-[62%] overflow-hidden rounded-t-2xl shadow-xs"
            style={{ backgroundColor: band }}
          >
            <div className="absolute inset-0 bg-foreground/10" />
            <span
              className="absolute inset-0 flex items-center px-3 text-xs font-medium tracking-tight"
              style={{ color: BOOK_INK }}
            >
              <span className="truncate">{folder.title}</span>
            </span>
          </div>

          {/* Paper strips: the newest asset titles peek out of the pocket. */}
          <div
            aria-hidden
            className="absolute right-10 bottom-[64%] left-6 flex flex-col items-start gap-1"
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
                  backgroundColor: bookColorOf(asset.id),
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
      </Link>

      <p className="mt-3 text-xs text-muted-foreground">
        {folderMetaLine(folder)}
      </p>
    </div>
  )
}

/** The library's home: the workspace's projects, stood up as folder cutouts. */
export function LibraryFolderWall({
  workspaceSlug,
  folders,
  onSeedScope,
}: {
  workspaceSlug: string
  folders: LibraryFolder[]
  onSeedScope?: (folderId: string) => void
}) {
  return (
    <section aria-label="Library folders">
      <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
        {folders.map((folder) => (
          <FolderCutout
            key={folder.id}
            workspaceSlug={workspaceSlug}
            folder={folder}
            onSeedScope={onSeedScope}
          />
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
 * record sheet beneath, inside the same grid cell. The sheet keeps the
 * house's honest facts: divergent approvals say both (the state dot is the
 * whole history's; the approved chip marks the row it belongs to).
 */
export function AssetBook({
  workspaceSlug,
  asset,
  expanded,
  onToggle,
  showProject = false,
}: {
  workspaceSlug: string
  asset: LibraryAssetSummary
  expanded: boolean
  onToggle: () => void
  /** On shelves spanning several projects, name the project on the face. */
  showProject?: boolean
}) {
  const reduce = useReducedMotion()
  const book = bookColorOf(asset.id)
  const approval = ASSET_STATE_META[asset.approvalState]

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
          "group block w-full rounded-xl text-left transition-transform duration-200 ease-out focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none",
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
            <div
              className="flex flex-col gap-0.5 text-[11px]"
              style={{ color: BOOK_INK_SOFT }}
            >
              {showProject && (
                <p className="truncate text-[10px] opacity-80">
                  {asset.projectTitle}
                </p>
              )}
              <p className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className={cn("size-2 shrink-0 rounded-full", approval.dot)}
                />
                <span className="truncate">{asset.assetType ?? "File"}</span>
              </p>
            </div>
          </div>

          {/* Tap/click affordance: mobile has no hover, so the hint is always
              shown; desktop reveals "Click to open" on hover. Both sit on the
              cover, so the card's grid cell never changes size. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <span
              className="sm:hidden rounded-full px-2.5 py-1 text-[11px] font-medium"
              style={{ color: BOOK_INK, backgroundColor: BOOK_SCRIM }}
            >
              Tap to open
            </span>
            <span className="hidden rounded-full bg-background/90 px-3 py-1 text-xs font-medium text-foreground opacity-0 shadow-sm transition-opacity duration-200 group-hover:opacity-100 sm:inline-flex">
              Click to open
            </span>
          </div>
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {expanded ? (
          <AssetRecordSheet
            workspaceSlug={workspaceSlug}
            asset={asset}
            onClose={onToggle}
          />
        ) : null}
      </AnimatePresence>
    </div>
  )
}

/**
 * The record beneath the lifted cover. Left column: the facts — who created
 * it and when, where the file lives, the latest version with its review dot,
 * the last ever approved version, the version count and the whole-history
 * approval state. Right column: the working link and the reserved artwork
 * zone. Beneath both, the asset's whole version timeline as quiet rows,
 * newest first, with the earlier ones behind an inline toggle so long
 * histories never dominate the sheet — and a way out to the full record for
 * the deep facts this quiet sheet does not carry (submitter notes, the
 * append-only decision history).
 */
function AssetRecordSheet({
  workspaceSlug,
  asset,
  onClose,
}: {
  workspaceSlug: string
  asset: LibraryAssetSummary
  onClose: () => void
}) {
  const reduce = useReducedMotion()
  const latest = asset.latestVersion
  const latestReview = latest?.reviewStatus
    ? REVIEW_DOTS[latest.reviewStatus]
    : null
  const approval = ASSET_STATE_META[asset.approvalState]
  const [showAllHistory, setShowAllHistory] = useState(false)

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
          {asset.createdBy && (
            <div>
              <p className="text-[11px] text-muted-foreground">Created by</p>
              <p className="mt-1 flex items-center gap-1.5">
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                    tintOf(asset.createdBy)
                  )}
                >
                  {initialsOf(asset.createdBy)}
                </span>
                <span className="truncate text-xs font-medium">
                  {asset.createdBy.name ??
                    asset.createdBy.email ??
                    "a former member"}
                </span>
              </p>
            </div>
          )}
          <div>
            <p className="text-[11px] text-muted-foreground">Created</p>
            <p className="mt-1 text-xs">{formatFullDate(asset.createdAt)}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">In</p>
            <p className="mt-1 truncate text-xs">
              <Link
                to="/w/$workspaceSlug/projects/$projectSlug"
                params={{ workspaceSlug, projectSlug: asset.projectSlug }}
                className="hover:underline"
              >
                {asset.projectTitle}
              </Link>
              {asset.deliverableTitle ? (
                <span className="text-muted-foreground">
                  {" · "}
                  {asset.deliverableTitle}
                </span>
              ) : null}
            </p>
          </div>
          <div className="flex flex-col gap-1.5 pt-1">
            {latest ? (
              <p className="flex items-center gap-1.5 text-xs">
                <span className="font-medium">{latest.label}</span>
                {latestReview ? (
                  <>
                    <span
                      aria-hidden
                      className={cn("size-2 shrink-0 rounded-full", latestReview.dot)}
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
              {asset.latestApproved
                ? `Latest approved ${asset.latestApproved.label}`
                : "Nothing approved yet"}
            </p>
            <p className="text-xs text-muted-foreground">
              {countOf(asset.versions.length, "version", "versions")}
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
                  title="A link to the file; Antara cannot detect changes to a linked file."
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

      {/* Version history — the asset's whole timeline, newest first, as a
          quiet list under the two-column record. Additive: the sheet grows
          to hold it, and long histories fold behind an inline toggle. */}
      {asset.versions.length > 0 && (
        <section aria-label="Version history" className="pt-3">
          <h4 className="text-[11px] font-medium tracking-widest text-muted-foreground uppercase">
            Version history ·{" "}
            {countOf(asset.versions.length, "version", "versions")}
          </h4>
          <ul className="mt-2 flex flex-col gap-1">
            {(showAllHistory
              ? asset.versions
              : asset.versions.slice(0, HISTORY_PREVIEW_COUNT)
            ).map((version, index) => {
              const review = version.reviewStatus
                ? REVIEW_DOTS[version.reviewStatus]
                : null
              const provider =
                version.source === "external_link"
                  ? version.externalProvider
                  : null
              return (
                <li
                  key={version.id}
                  className={cn(
                    "flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-lg px-2 py-1.5",
                    index === 0 && "bg-muted/50"
                  )}
                >
                  <span className="text-xs font-medium tabular-nums">
                    {version.label}
                  </span>
                  <span className="flex items-baseline gap-1.5 text-[11px] text-muted-foreground">
                    {review ? (
                      <>
                        <span
                          aria-hidden
                          className={cn("size-2 shrink-0 rounded-full", review.dot)}
                        />
                        {review.label}
                      </>
                    ) : (
                      "(draft)"
                    )}
                  </span>
                  {provider ? (
                    <span className="text-[10px] text-muted-foreground/70">
                      {provider}
                    </span>
                  ) : null}
                  <span className="ml-auto min-w-0 truncate text-[11px] text-muted-foreground/80">
                    {formatRelativeTime(version.createdAt)} ·{" "}
                    {version.submitter.name ??
                      version.submitter.email ??
                      "a former member"}
                  </span>
                  {index === 0 && (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      Latest
                    </span>
                  )}
                  {version.id === asset.latestApproved?.id && (
                    <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                      Approved
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
          {asset.versions.length > HISTORY_PREVIEW_COUNT && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                setShowAllHistory((current) => !current)
              }}
              aria-expanded={showAllHistory}
              className="mt-1 rounded-md px-2 py-1 text-left text-[11px] text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {showAllHistory
                ? "Show fewer versions"
                : `Show ${countOf(asset.versions.length - HISTORY_PREVIEW_COUNT, "earlier version", "earlier versions")}`}
            </button>
          )}
        </section>
      )}

      {/* The deep-linked record keeps the facts this quiet sheet does not. */}
      <div className="pt-3">
        <Link
          to="/w/$workspaceSlug/library/$assetId"
          params={{ workspaceSlug, assetId: asset.id }}
          className="inline-flex items-center gap-1.5 rounded-md text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          Open the full record
          <ArrowUpRightIcon className="size-3.5" aria-hidden />
        </Link>
      </div>
    </motion.div>
  )
}
