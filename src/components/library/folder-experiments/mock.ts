/**
 * Shared mock world for the library folder-cutout concept sprint (local
 * only — nothing here touches the server).
 *
 * Shapes deliberately mirror the real lane payloads they will replace at
 * integration time: `MockAsset` ⇄ `LibraryAssetSummary` (library-service)
 * flattened with the FR-040 detail facts the book expansion shows (creator,
 * created date, the link); `MockVersion` ⇄ `LibraryVersionDetail` with the
 * decision history flattened away for now; `MockFolder` ⇄ the project
 * grouping as the folder cutout presents it — a folder is titled by its
 * project. `versionHistory` carries the asset's WHOLE version timeline,
 * newest first, exactly the order the library detail page uses, so the book
 * card can show earlier versions without a second fetch at integration.
 *
 * The approval-state buckets are derived here with the same rule
 * `assetApprovalState` (library-scoping) encodes: approved ⟺ some version
 * was approved; superseded ⟺ superseded rows and no approval; everything
 * else — drafts, in-review, rejected, changes-requested — heaps into the
 * honest `not_approved`.
 *
 * House bans honoured: no borders, no spinners — the sprint communicates
 * through washes, spacing, dots and text tone.
 */

/* --------------------------------- people -------------------------------- */

export interface MockPerson {
  id: string
  name: string
  email: string
}

export const MOCK_MEMBERS: MockPerson[] = [
  { id: "m-1", name: "Maya Chen", email: "maya@studio.example" },
  { id: "m-2", name: "Felix Odeh", email: "felix@studio.example" },
  { id: "m-3", name: "Petra Lindqvist", email: "petra@studio.example" },
  { id: "m-4", name: "Samir Haddad", email: "samir@studio.example" },
  { id: "m-5", name: "June Park", email: "june@studio.example" },
  { id: "m-6", name: "Rita Alvarez", email: "rita@studio.example" },
]

const maya = MOCK_MEMBERS[0]!
const felix = MOCK_MEMBERS[1]!
const petra = MOCK_MEMBERS[2]!
const samir = MOCK_MEMBERS[3]!
const june = MOCK_MEMBERS[4]!
const rita = MOCK_MEMBERS[5]!

/* --------------------------------- types --------------------------------- */

/**
 * One entry in an asset's version timeline. A version's `reviewStatus` null
 * = draft — never submitted for review; the FR-037 facts on the card are
 * derived from this list, newest first.
 */
export interface MockVersion {
  versionNo: number
  label: string
  /** "external_link" (Antara cannot vouch for the file) vs hosted upload. */
  source: "external_link" | "upload"
  url: string
  /** For external links: which provider the URL points at. */
  externalProvider: string | null
  mimeType: string | null
  /** null = draft — never submitted for review. */
  reviewStatus:
    | "submitted"
    | "approved"
    | "rejected"
    | "changes_requested"
    | "superseded"
    | null
  submittedAt: Date | null
  createdAt: Date
  submitter: MockPerson
}

/**
 * One asset on the shelf: the file's name (the title a book displays), who
 * created it and when (the FR-040 facts the expansion opens with), where it
 * lives (its deliverable), and its whole version history.
 */
export interface MockAsset {
  id: string
  filename: string
  assetType: string | null
  tags: string[] | null
  /** Who added this file to the library — "created by" in the expansion. */
  createdBy: MockPerson
  createdAt: Date
  updatedAt: Date
  deliverableTitle: string | null
  versionCount: number
  /** The FR-037 facts: the newest version and the last ever approved. */
  latestVersion: MockVersion
  latestApprovedLabel: string | null
  approvalState: "approved" | "superseded" | "not_approved"
  /** The whole timeline, NEWEST FIRST — same order the detail page uses. */
  versionHistory: MockVersion[]
}

/**
 * The folder cutout's record. A folder is titled by the project it belongs
 * to; its assets are the books that peek inside it and stand on its shelf.
 */
export interface MockFolder {
  id: string
  /** The project's name — the folder's title. */
  title: string
  slug: string
  updatedAt: Date
  assets: MockAsset[]
}

/* ------------------------------- composer -------------------------------- */
//
// Assets are declared as a base record plus the NEWEST version and, for the
// files with history, the older entries. Everything the cards display — the
// FR-037 flags and the approval-state buckets — derives from the composed
// timeline, so the mock can never contradict itself the way hand-typed
// summary fields can.

/** Builder inputs for an older, non-head version. */
interface VersionSeed {
  versionNo: number
  when: Date
  reviewStatus: MockVersion["reviewStatus"]
  /** Defaults: the file's usual source/provider with its own URL null. */
  source?: MockVersion["source"]
  externalProvider?: string | null
  url?: string
  submitter?: MockPerson
}

function approvalStateOf(versions: MockVersion[]): MockAsset["approvalState"] {
  const seen = versions.map((version) => version.reviewStatus)
  if (seen.includes("approved")) return "approved"
  if (seen.includes("superseded")) return "superseded"
  return "not_approved"
}

function composeAsset(
  base: Pick<
    MockAsset,
    | "id"
    | "filename"
    | "assetType"
    | "tags"
    | "createdBy"
    | "createdAt"
    | "updatedAt"
    | "deliverableTitle"
  >,
  latestVersion: MockVersion,
  older: VersionSeed[]
): MockAsset {
  const versionHistory: MockVersion[] = [
    latestVersion,
    ...older.map((seed) => ({
      versionNo: seed.versionNo,
      label: `v${seed.versionNo}`,
      source: seed.source ?? latestVersion.source,
      url: seed.url ?? latestVersion.url,
      externalProvider:
        seed.externalProvider ?? latestVersion.externalProvider,
      mimeType: seed.source === "upload" ? (latestVersion.mimeType ?? null) : null,
      reviewStatus: seed.reviewStatus,
      submittedAt: seed.reviewStatus ? seed.when : null,
      createdAt: seed.when,
      submitter: seed.submitter ?? latestVersion.submitter,
    })),
  ]
  const approved = versionHistory.find(
    (version) => version.reviewStatus === "approved"
  )
  return {
    ...base,
    versionCount: versionHistory.length,
    latestVersion,
    latestApprovedLabel: approved ? approved.label : null,
    approvalState: approvalStateOf(versionHistory),
    versionHistory,
  }
}

/* ---------------------------------- time --------------------------------- */

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

function recent(minutes: number): Date {
  return new Date(Date.now() - minutes * 60 * 1000)
}

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
})

/** "12 Mar 2026" — the expansion's date line. */
export function formatFullDate(date: Date): string {
  return DATE_FORMAT.format(date)
}

/** "2 days ago" — folder and card meta lines. Coarse on purpose. */
export function formatRelative(date: Date): string {
  const minutes = Math.max(0, (Date.now() - date.getTime()) / 60_000)
  if (minutes < 60) {
    if (minutes < 1) return "just now"
    const m = Math.round(minutes)
    return `${m} minute${m === 1 ? "" : "s"} ago`
  }
  const hours = minutes / 60
  if (hours < 24) {
    const h = Math.round(hours)
    return `${h} hour${h === 1 ? "" : "s"} ago`
  }
  const days = hours / 24
  if (days < 14) {
    const d = Math.round(days)
    return `${d} day${d === 1 ? "" : "s"} ago`
  }
  const weeks = days / 7
  if (weeks < 9) {
    const w = Math.round(weeks)
    return `${w} week${w === 1 ? "" : "s"} ago`
  }
  const months = days / 30.44
  const mo = Math.round(months)
  return `${mo} month${mo === 1 ? "" : "s"} ago`
}

/** "12 Mar" — the compact stamp for tight surfaces. */
export function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(date)
}

/* -------------------------------- helpers -------------------------------- */

export function initialsOf(name: string | null | undefined): string {
  const first = name?.trim()[0]
  return first ? first.toUpperCase() : "?"
}

/** Stable avatar tint classes for a person, straight from the house tint pool. */
export function tintOf(person: MockPerson): string {
  const pool = [
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
  let h = 2166136261
  for (let i = 0; i < person.id.length; i++) {
    h ^= person.id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return pool[(h >>> 0) % pool.length]!
}

/* --------------------------------- colors -------------------------------- */

function hash(value: string): number {
  let h = 2166136261
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/**
 * Folder accents — lifted verbatim from `project-cover-art` so a library
 * folder cutout and its project's card read as the same object wearing the
 * same colour when they sit in one app.
 */
const FOLDER_ACCENTS = [
  "oklch(0.72 0.19 350)", // pink
  "oklch(0.74 0.17 25)", // coral
  "oklch(0.78 0.17 70)", // amber
  "oklch(0.80 0.16 130)", // lime
  "oklch(0.75 0.16 165)", // teal
  "oklch(0.72 0.16 250)", // blue
  "oklch(0.73 0.18 300)", // violet
  "oklch(0.76 0.18 15)", // red
]

/** The folder's accent, stable per project slug. */
export function folderAccent(slug: string): string {
  return FOLDER_ACCENTS[hash(slug) % FOLDER_ACCENTS.length]!
}

/**
 * Book colours — one notch deeper than the folder band so near-white ink
 * (BOOK_INK below) reads comfortably on any of them, and so a shelf of
 * books never competes with the project-coloured folders behind it.
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
export function assetBookColor(assetId: string): string {
  return BOOK_COLORS[hash(assetId) % BOOK_COLORS.length]!
}

/** Near-white ink that holds on every book colour. */
export const BOOK_INK = "oklch(0.97 0.005 260)"

/** The same ink at rest — for meta lines and quiet corners of a book face. */
export const BOOK_INK_SOFT = "oklch(0.90 0.01 260)"

/* ------------------------------ metadata dots ---------------------------- */

/** The approval state of the asset's WHOLE history, as the shelf reads it. */
export const APPROVAL_META: Record<
  MockAsset["approvalState"],
  { label: string; dot: string; hint: string }
> = {
  approved: {
    label: "Approved",
    dot: "bg-emerald-500",
    hint: "A version of this file was approved.",
  },
  superseded: {
    label: "Superseded",
    dot: "bg-muted-foreground/40",
    hint: "Parts of the history were superseded; nothing newer has been approved.",
  },
  not_approved: {
    label: "Not approved",
    dot: "bg-sky-500",
    hint: "No version of this file has been approved yet.",
  },
}

/** Per-version review dots, for expansion details. */
export const REVIEW_DOTS: Record<
  NonNullable<MockVersion["reviewStatus"]>,
  { label: string; dot: string }
> = {
  submitted: { label: "In review", dot: "bg-blue-500" },
  approved: { label: "Approved", dot: "bg-emerald-500" },
  rejected: { label: "Rejected", dot: "bg-red-500" },
  changes_requested: { label: "Changes requested", dot: "bg-amber-500" },
  superseded: { label: "Superseded", dot: "bg-muted-foreground/40" },
}

/** How the file arrived — the link row's leading label. */
export function sourceLabel(version: MockVersion): string {
  if (version.source === "external_link") {
    return version.externalProvider
      ? `${version.externalProvider} link`
      : "External link"
  }
  return "Hosted upload"
}

/* ---------------------------------- data --------------------------------- */

export const MOCK_FOLDERS: MockFolder[] = [
  {
    id: "f-aurora",
    title: "Aurora — spring refresh",
    slug: "aurora-spring-refresh",
    updatedAt: recent(300),
    assets: [
      composeAsset(
        {
          id: "a-aur-1",
          filename: "aurora_teaser_45s_v8.mp4",
          assetType: "Video",
          tags: ["hero", "teaser"],
          createdBy: maya,
          createdAt: daysAgo(41),
          updatedAt: recent(300),
          deliverableTitle: "Launch teaser video",
        },
        {
          versionNo: 8,
          label: "v8",
          source: "external_link",
          url: "https://drive.google.com/file/d/1Aur0rA8zTe4sErV8/view",
          externalProvider: "Google Drive",
          mimeType: null,
          reviewStatus: "submitted",
          submittedAt: recent(310),
          createdAt: recent(315),
          submitter: maya,
        },
        [
          { versionNo: 7, when: daysAgo(6), reviewStatus: "approved", url: "https://drive.google.com/file/d/1Aur0rA8zTe4sErV7/view" },
          { versionNo: 6, when: daysAgo(11), reviewStatus: "changes_requested", url: "https://drive.google.com/file/d/1Aur0rA8zTe4sErV6/view" },
          { versionNo: 5, when: daysAgo(18), reviewStatus: "approved", url: "https://drive.google.com/file/d/1Aur0rA8zTe4sErV5/view" },
          { versionNo: 4, when: daysAgo(24), reviewStatus: "rejected", url: "https://drive.google.com/file/d/1Aur0rA8zTe4sErV4/view" },
          { versionNo: 3, when: daysAgo(30), reviewStatus: "approved", url: "https://drive.google.com/file/d/1Aur0rA8zTe4sErV3/view" },
          { versionNo: 2, when: daysAgo(36), reviewStatus: "approved", url: "https://drive.google.com/file/d/1Aur0rA8zTe4sErV2/view" },
          { versionNo: 1, when: daysAgo(41), reviewStatus: "approved", url: "https://drive.google.com/file/d/1Aur0rA8zTe4sErV1/view" },
        ]
      ),
      composeAsset(
        {
          id: "a-aur-2",
          filename: "hero-moodboard_v3.pdf",
          assetType: "Design",
          tags: ["moodboard"],
          createdBy: petra,
          createdAt: daysAgo(52),
          updatedAt: daysAgo(6),
          deliverableTitle: "Art direction",
        },
        {
          versionNo: 3,
          label: "v3",
          source: "external_link",
          url: "https://www.figma.com/file/qT4pK8H2/aurora-moodboard-v3",
          externalProvider: "Figma",
          mimeType: null,
          reviewStatus: "changes_requested",
          submittedAt: daysAgo(7),
          createdAt: daysAgo(7),
          submitter: petra,
        },
        [
          { versionNo: 2, when: daysAgo(20), reviewStatus: "approved", url: "https://www.figma.com/file/qT4pK8H2/aurora-moodboard-v2" },
          { versionNo: 1, when: daysAgo(52), reviewStatus: "approved", url: "https://www.figma.com/file/qT4pK8H2/aurora-moodboard-v1" },
        ]
      ),
      composeAsset(
        {
          id: "a-aur-3",
          filename: "brand-guidelines_v3.pdf",
          assetType: "Document",
          tags: ["guidelines", "reference"],
          createdBy: rita,
          createdAt: daysAgo(60),
          updatedAt: daysAgo(21),
          deliverableTitle: "Brand guidelines",
        },
        {
          versionNo: 3,
          label: "v3",
          source: "external_link",
          url: "https://docs.google.com/document/d/1BrAndGu1d3l1n3s/edit",
          externalProvider: "Google Docs",
          mimeType: null,
          reviewStatus: "approved",
          submittedAt: daysAgo(22),
          createdAt: daysAgo(22),
          submitter: rita,
        },
        [
          { versionNo: 2, when: daysAgo(45), reviewStatus: "approved", url: "https://docs.google.com/document/d/1BrAndGu1d3l1n2/edit" },
          { versionNo: 1, when: daysAgo(60), reviewStatus: "approved", url: "https://docs.google.com/document/d/1BrAndGu1d3l1n1/edit" },
        ]
      ),
      composeAsset(
        {
          id: "a-aur-4",
          filename: "logo-lockups.fig",
          assetType: "Design",
          tags: ["logo"],
          createdBy: samir,
          createdAt: daysAgo(44),
          updatedAt: daysAgo(9),
          deliverableTitle: "Identity system",
        },
        {
          versionNo: 2,
          label: "v2",
          source: "external_link",
          url: "https://www.figma.com/file/oL9gO2L4/aurora-lockups-v2",
          externalProvider: "Figma",
          mimeType: null,
          reviewStatus: null,
          submittedAt: null,
          createdAt: daysAgo(9),
          submitter: samir,
        },
        [
          { versionNo: 1, when: daysAgo(44), reviewStatus: null, url: "https://www.figma.com/file/oL9gO2L4/aurora-lockups-v1" },
        ]
      ),
      composeAsset(
        {
          id: "a-aur-5",
          filename: "soundbed_loop_v1.wav",
          assetType: "Audio",
          tags: ["sound"],
          createdBy: felix,
          createdAt: daysAgo(12),
          updatedAt: daysAgo(12),
          deliverableTitle: "Launch teaser video",
        },
        {
          versionNo: 1,
          label: "v1",
          source: "upload",
          url: "https://res.cloudinary.com/demo/raw/upload/v1/aurora/soundbed_loop_v1.wav",
          externalProvider: null,
          mimeType: "audio/wav",
          reviewStatus: null,
          submittedAt: null,
          createdAt: daysAgo(12),
          submitter: felix,
        },
        []
      ),
      composeAsset(
        {
          id: "a-aur-6",
          filename: "subtitle-master_v4.srt",
          assetType: "Caption",
          tags: ["accessibility"],
          createdBy: june,
          createdAt: daysAgo(28),
          updatedAt: daysAgo(5),
          deliverableTitle: "Launch teaser video",
        },
        {
          versionNo: 4,
          label: "v4",
          source: "upload",
          url: "https://res.cloudinary.com/demo/raw/upload/v1/aurora/subtitle-master_v4.srt",
          externalProvider: null,
          mimeType: "application/x-subrip",
          reviewStatus: "superseded",
          submittedAt: daysAgo(8),
          createdAt: daysAgo(5),
          submitter: june,
        },
        [
          { versionNo: 3, when: daysAgo(12), reviewStatus: "superseded", url: "https://res.cloudinary.com/demo/raw/upload/v1/aurora/subtitle-master_v3.srt" },
          { versionNo: 2, when: daysAgo(19), reviewStatus: "rejected", url: "https://res.cloudinary.com/demo/raw/upload/v1/aurora/subtitle-master_v2.srt" },
          { versionNo: 1, when: daysAgo(28), reviewStatus: "rejected", url: "https://res.cloudinary.com/demo/raw/upload/v1/aurora/subtitle-master_v1.srt" },
        ]
      ),
      composeAsset(
        {
          id: "a-aur-7",
          filename: "paid-placement_alt_15s.mp4",
          assetType: "Video",
          tags: ["paid"],
          createdBy: maya,
          createdAt: daysAgo(3),
          updatedAt: recent(1200),
          deliverableTitle: "Launch teaser video",
        },
        {
          versionNo: 1,
          label: "v1",
          source: "external_link",
          url: "https://drive.google.com/file/d/1P41dPl4c3m3n7V1/view",
          externalProvider: "Google Drive",
          mimeType: null,
          reviewStatus: "submitted",
          submittedAt: recent(1210),
          createdAt: recent(1220),
          submitter: maya,
        },
        []
      ),
      composeAsset(
        {
          id: "a-aur-8",
          filename: "aurora_shotlist_v2.gdoc",
          assetType: "Document",
          tags: ["planning"],
          createdBy: petra,
          createdAt: daysAgo(48),
          updatedAt: daysAgo(18),
          deliverableTitle: "Art direction",
        },
        {
          versionNo: 2,
          label: "v2",
          source: "external_link",
          url: "https://docs.google.com/document/d/1Sh0tL1sT2Aur/edit",
          externalProvider: "Google Docs",
          mimeType: null,
          reviewStatus: "approved",
          submittedAt: daysAgo(19),
          createdAt: daysAgo(19),
          submitter: petra,
        },
        [
          { versionNo: 1, when: daysAgo(48), reviewStatus: "approved", url: "https://docs.google.com/document/d/1Sh0tL1sT2Auv/edit" },
        ]
      ),
    ],
  },
  {
    id: "f-northwind",
    title: "Northwind rebrand",
    slug: "northwind-rebrand",
    updatedAt: daysAgo(2),
    assets: [
      composeAsset(
        {
          id: "a-nw-1",
          filename: "northwind_wordmark.svg",
          assetType: "Design",
          tags: ["wordmark"],
          createdBy: samir,
          createdAt: daysAgo(70),
          updatedAt: daysAgo(2),
          deliverableTitle: "Identity system",
        },
        {
          versionNo: 5,
          label: "v5",
          source: "external_link",
          url: "https://www.dropbox.com/scl/fi/nw-wordmark-v5.svg",
          externalProvider: "Dropbox",
          mimeType: null,
          reviewStatus: "approved",
          submittedAt: daysAgo(3),
          createdAt: daysAgo(3),
          submitter: samir,
        },
        [
          { versionNo: 4, when: daysAgo(18), reviewStatus: "approved", url: "https://www.dropbox.com/scl/fi/nw-wordmark-v4.svg" },
          { versionNo: 3, when: daysAgo(33), reviewStatus: "changes_requested", url: "https://www.dropbox.com/scl/fi/nw-wordmark-v3.svg" },
          { versionNo: 2, when: daysAgo(48), reviewStatus: "approved", url: "https://www.dropbox.com/scl/fi/nw-wordmark-v2.svg" },
          { versionNo: 1, when: daysAgo(70), reviewStatus: "approved", url: "https://www.dropbox.com/scl/fi/nw-wordmark-v1.svg" },
        ]
      ),
      composeAsset(
        {
          id: "a-nw-2",
          filename: "palette-exploration.fig",
          assetType: "Design",
          tags: ["palette"],
          createdBy: rita,
          createdAt: daysAgo(65),
          updatedAt: daysAgo(4),
          deliverableTitle: "Identity system",
        },
        {
          versionNo: 2,
          label: "v2",
          source: "external_link",
          url: "https://www.figma.com/file/p4L3Tt3RnW/palette-exploration-v2",
          externalProvider: "Figma",
          mimeType: null,
          reviewStatus: "submitted",
          submittedAt: daysAgo(4),
          createdAt: daysAgo(4),
          submitter: rita,
        },
        [
          { versionNo: 1, when: daysAgo(65), reviewStatus: null, url: "https://www.figma.com/file/p4L3Tt3RnW/palette-exploration-v1" },
        ]
      ),
      composeAsset(
        {
          id: "a-nw-3",
          filename: "stationery-mockups.pdf",
          assetType: "Print",
          tags: ["stationery"],
          createdBy: june,
          createdAt: daysAgo(58),
          updatedAt: daysAgo(25),
          deliverableTitle: "Collateral",
        },
        {
          versionNo: 3,
          label: "v3",
          source: "upload",
          url: "https://res.cloudinary.com/demo/image/upload/v1/northwind/stationery-mockups.pdf",
          externalProvider: null,
          mimeType: "application/pdf",
          reviewStatus: "superseded",
          submittedAt: daysAgo(26),
          createdAt: daysAgo(25),
          submitter: june,
        },
        [
          { versionNo: 2, when: daysAgo(45), reviewStatus: "changes_requested", url: "https://res.cloudinary.com/demo/image/upload/v1/northwind/stationery-mockups-v2.pdf" },
          { versionNo: 1, when: daysAgo(58), reviewStatus: null, url: "https://res.cloudinary.com/demo/image/upload/v1/northwind/stationery-mockups-v1.pdf" },
        ]
      ),
      composeAsset(
        {
          id: "a-nw-4",
          filename: "nw-brand-guidelines.pdf",
          assetType: "Document",
          tags: ["guidelines"],
          createdBy: rita,
          createdAt: daysAgo(50),
          updatedAt: daysAgo(10),
          deliverableTitle: "Brand guidelines",
        },
        {
          versionNo: 2,
          label: "v2",
          source: "external_link",
          url: "https://docs.google.com/document/d/1NwGu1d3l1n3sV2/edit",
          externalProvider: "Google Docs",
          mimeType: null,
          reviewStatus: "approved",
          submittedAt: daysAgo(11),
          createdAt: daysAgo(11),
          submitter: rita,
        },
        [
          { versionNo: 1, when: daysAgo(50), reviewStatus: null, url: "https://docs.google.com/document/d/1NwGu1d3l1n3sV1/edit" },
        ]
      ),
      composeAsset(
        {
          id: "a-nw-5",
          filename: "iconography-sheet.pdf",
          assetType: "Design",
          tags: ["icons"],
          createdBy: felix,
          createdAt: daysAgo(15),
          updatedAt: daysAgo(15),
          deliverableTitle: "Identity system",
        },
        {
          versionNo: 1,
          label: "v1",
          source: "external_link",
          url: "https://drive.google.com/file/d/1Ic0nShe3tV1/view",
          externalProvider: "Google Drive",
          mimeType: null,
          reviewStatus: "rejected",
          submittedAt: daysAgo(14),
          createdAt: daysAgo(14),
          submitter: felix,
        },
        []
      ),
    ],
  },
  {
    id: "f-harbour",
    title: "Harbour House launch",
    slug: "harbour-house-launch",
    updatedAt: recent(800),
    assets: [
      composeAsset(
        {
          id: "a-hh-1",
          filename: "harbour-hero_still.jpg",
          assetType: "Photography",
          tags: ["hero"],
          createdBy: petra,
          createdAt: daysAgo(28),
          updatedAt: daysAgo(1),
          deliverableTitle: "Site imagery",
        },
        {
          versionNo: 2,
          label: "v2",
          source: "upload",
          url: "https://res.cloudinary.com/demo/image/upload/v1/harbour/harbour-hero_still.jpg",
          externalProvider: null,
          mimeType: "image/jpeg",
          reviewStatus: "approved",
          submittedAt: daysAgo(2),
          createdAt: daysAgo(2),
          submitter: petra,
        },
        [
          { versionNo: 1, when: daysAgo(28), reviewStatus: null, url: "https://res.cloudinary.com/demo/image/upload/v1/harbour/harbour-hero_still_v1.jpg" },
        ]
      ),
      composeAsset(
        {
          id: "a-hh-2",
          filename: "launch-email_v2.gdoc",
          assetType: "Copy",
          tags: ["email"],
          createdBy: rita,
          createdAt: daysAgo(20),
          updatedAt: recent(800),
          deliverableTitle: "Launch comms",
        },
        {
          versionNo: 2,
          label: "v2",
          source: "external_link",
          url: "https://docs.google.com/document/d/1L4unCh3mA1lV2/edit",
          externalProvider: "Google Docs",
          mimeType: null,
          reviewStatus: "submitted",
          submittedAt: recent(810),
          createdAt: recent(830),
          submitter: rita,
        },
        [
          { versionNo: 1, when: daysAgo(10), reviewStatus: "changes_requested", url: "https://docs.google.com/document/d/1L4unCh3mA1lV1/edit" },
        ]
      ),
      composeAsset(
        {
          id: "a-hh-3",
          filename: "press-release-final.pdf",
          assetType: "Document",
          tags: ["press"],
          createdBy: samir,
          createdAt: daysAgo(11),
          updatedAt: daysAgo(11),
          deliverableTitle: "Launch comms",
        },
        {
          versionNo: 1,
          label: "v1",
          source: "upload",
          url: "https://res.cloudinary.com/demo/image/upload/v1/harbour/press-release-final.pdf",
          externalProvider: null,
          mimeType: "application/pdf",
          reviewStatus: "approved",
          submittedAt: daysAgo(10),
          createdAt: daysAgo(10),
          submitter: samir,
        },
        []
      ),
      composeAsset(
        {
          id: "a-hh-4",
          filename: "listing-photography_brief.pdf",
          assetType: "Document",
          tags: ["brief"],
          createdBy: june,
          createdAt: daysAgo(6),
          updatedAt: daysAgo(6),
          deliverableTitle: "Site imagery",
        },
        {
          versionNo: 1,
          label: "v1",
          source: "external_link",
          url: "https://drive.google.com/file/d/1L1sT1n6PSh0rt/view",
          externalProvider: "Google Drive",
          mimeType: null,
          reviewStatus: null,
          submittedAt: null,
          createdAt: daysAgo(6),
          submitter: june,
        },
        []
      ),
    ],
  },
  {
    id: "f-fieldnotes",
    title: "Field Notes podcast",
    slug: "field-notes-podcast",
    updatedAt: daysAgo(1),
    assets: [
      composeAsset(
        {
          id: "a-fn-1",
          filename: "episode-02_mixdown.wav",
          assetType: "Audio",
          tags: ["episode"],
          createdBy: felix,
          createdAt: daysAgo(16),
          updatedAt: recent(1500),
          deliverableTitle: "Season two production",
        },
        {
          versionNo: 4,
          label: "v4",
          source: "upload",
          url: "https://res.cloudinary.com/demo/video/upload/v1/fieldnotes/episode-02_mixdown.wav",
          externalProvider: null,
          mimeType: "audio/wav",
          reviewStatus: "submitted",
          submittedAt: recent(1600),
          createdAt: recent(1700),
          submitter: felix,
        },
        [
          { versionNo: 3, when: daysAgo(8), reviewStatus: "approved", url: "https://res.cloudinary.com/demo/video/upload/v1/fieldnotes/episode-02_mixdown_v3.wav" },
          { versionNo: 2, when: daysAgo(12), reviewStatus: "changes_requested", url: "https://res.cloudinary.com/demo/video/upload/v1/fieldnotes/episode-02_mixdown_v2.wav" },
          { versionNo: 1, when: daysAgo(16), reviewStatus: null, url: "https://res.cloudinary.com/demo/video/upload/v1/fieldnotes/episode-02_mixdown_v1.wav" },
        ]
      ),
      composeAsset(
        {
          id: "a-fn-2",
          filename: "episode-01_final.wav",
          assetType: "Audio",
          tags: ["episode"],
          createdBy: felix,
          createdAt: daysAgo(40),
          updatedAt: daysAgo(23),
          deliverableTitle: "Season two production",
        },
        {
          versionNo: 3,
          label: "v3",
          source: "upload",
          url: "https://res.cloudinary.com/demo/video/upload/v1/fieldnotes/episode-01_final.wav",
          externalProvider: null,
          mimeType: "audio/wav",
          reviewStatus: "approved",
          submittedAt: daysAgo(24),
          createdAt: daysAgo(24),
          submitter: felix,
        },
        [
          { versionNo: 2, when: daysAgo(33), reviewStatus: "approved", url: "https://res.cloudinary.com/demo/video/upload/v1/fieldnotes/episode-01_final_v2.wav" },
          { versionNo: 1, when: daysAgo(40), reviewStatus: null, url: "https://res.cloudinary.com/demo/video/upload/v1/fieldnotes/episode-01_final_v1.wav" },
        ]
      ),
      composeAsset(
        {
          id: "a-fn-3",
          filename: "episode-covers_s2.fig",
          assetType: "Design",
          tags: ["covers"],
          createdBy: petra,
          createdAt: daysAgo(38),
          updatedAt: daysAgo(13),
          deliverableTitle: "Cover art",
        },
        {
          versionNo: 3,
          label: "v3",
          source: "external_link",
          url: "https://www.figma.com/file/c0v3Rs2F1/episode-covers-s2-v3",
          externalProvider: "Figma",
          mimeType: null,
          reviewStatus: "superseded",
          submittedAt: daysAgo(14),
          createdAt: daysAgo(13),
          submitter: petra,
        },
        [
          { versionNo: 2, when: daysAgo(27), reviewStatus: "changes_requested", url: "https://www.figma.com/file/c0v3Rs2F1/episode-covers-s2-v2" },
          { versionNo: 1, when: daysAgo(38), reviewStatus: "submitted", url: "https://www.figma.com/file/c0v3Rs2F1/episode-covers-s2-v1" },
        ]
      ),
      composeAsset(
        {
          id: "a-fn-4",
          filename: "transcript_ep01.pdf",
          assetType: "Document",
          tags: ["transcript"],
          createdBy: june,
          createdAt: daysAgo(21),
          updatedAt: daysAgo(21),
          deliverableTitle: "Show notes",
        },
        {
          versionNo: 1,
          label: "v1",
          source: "upload",
          url: "https://res.cloudinary.com/demo/image/upload/v1/fieldnotes/transcript_ep01.pdf",
          externalProvider: null,
          mimeType: "application/pdf",
          reviewStatus: "approved",
          submittedAt: daysAgo(20),
          createdAt: daysAgo(20),
          submitter: june,
        },
        []
      ),
      composeAsset(
        {
          id: "a-fn-5",
          filename: "shownotes-template.gdoc",
          assetType: "Copy",
          tags: ["template"],
          createdBy: maya,
          createdAt: daysAgo(30),
          updatedAt: daysAgo(30),
          deliverableTitle: "Show notes",
        },
        {
          versionNo: 1,
          label: "v1",
          source: "external_link",
          url: "https://docs.google.com/document/d/1Sh0wN0t3sT3mP/edit",
          externalProvider: "Google Docs",
          mimeType: null,
          reviewStatus: null,
          submittedAt: null,
          createdAt: daysAgo(30),
          submitter: maya,
        },
        []
      ),
      composeAsset(
        {
          id: "a-fn-6",
          filename: "guest-questions_ep03.gdoc",
          assetType: "Copy",
          tags: ["planning"],
          createdBy: samir,
          createdAt: daysAgo(4),
          updatedAt: daysAgo(4),
          deliverableTitle: "Season two production",
        },
        {
          versionNo: 1,
          label: "v1",
          source: "external_link",
          url: "https://docs.google.com/document/d/1Gu3stQ03st10nS/edit",
          externalProvider: "Google Docs",
          mimeType: null,
          reviewStatus: "changes_requested",
          submittedAt: daysAgo(3),
          createdAt: daysAgo(3),
          submitter: samir,
        },
        []
      ),
    ],
  },
  {
    id: "f-atlas",
    title: "Atlas onboarding",
    slug: "atlas-onboarding",
    updatedAt: daysAgo(5),
    assets: [
      composeAsset(
        {
          id: "a-at-1",
          filename: "onboarding-flow_v3.pdf",
          assetType: "Document",
          tags: ["flow"],
          createdBy: june,
          createdAt: daysAgo(28),
          updatedAt: daysAgo(7),
          deliverableTitle: "Product tour",
        },
        {
          versionNo: 3,
          label: "v3",
          source: "external_link",
          url: "https://drive.google.com/file/d/10nb04rd1n6V3/view",
          externalProvider: "Google Drive",
          mimeType: null,
          reviewStatus: "approved",
          submittedAt: daysAgo(8),
          createdAt: daysAgo(8),
          submitter: june,
        },
        [
          { versionNo: 2, when: daysAgo(16), reviewStatus: "changes_requested", url: "https://drive.google.com/file/d/10nb04rd1n6V2/view" },
          { versionNo: 1, when: daysAgo(28), reviewStatus: null, url: "https://drive.google.com/file/d/10nb04rd1n6V1/view" },
        ]
      ),
      composeAsset(
        {
          id: "a-at-2",
          filename: "welcome-screen_copy.gdoc",
          assetType: "Copy",
          tags: ["copy"],
          createdBy: rita,
          createdAt: daysAgo(22),
          updatedAt: daysAgo(5),
          deliverableTitle: "Product tour",
        },
        {
          versionNo: 2,
          label: "v2",
          source: "external_link",
          url: "https://docs.google.com/document/d/1W3lcom3Scr33nV2/edit",
          externalProvider: "Google Docs",
          mimeType: null,
          reviewStatus: "submitted",
          submittedAt: daysAgo(5),
          createdAt: daysAgo(5),
          submitter: rita,
        },
        [
          { versionNo: 1, when: daysAgo(22), reviewStatus: null, url: "https://docs.google.com/document/d/1W3lcom3Scr33nV1/edit" },
        ]
      ),
      composeAsset(
        {
          id: "a-at-3",
          filename: "product-tour_90s.mp4",
          assetType: "Video",
          tags: ["tour"],
          createdBy: maya,
          createdAt: daysAgo(14),
          updatedAt: daysAgo(14),
          deliverableTitle: "Product tour",
        },
        {
          versionNo: 1,
          label: "v1",
          source: "upload",
          url: "https://res.cloudinary.com/demo/video/upload/v1/atlas/product-tour_90s.mp4",
          externalProvider: null,
          mimeType: "video/mp4",
          reviewStatus: "changes_requested",
          submittedAt: daysAgo(12),
          createdAt: daysAgo(12),
          submitter: maya,
        },
        []
      ),
    ],
  },
  {
    id: "f-sable",
    title: "Sable look book",
    slug: "sable-look-book",
    updatedAt: daysAgo(9),
    assets: [
      composeAsset(
        {
          id: "a-sb-1",
          filename: "sable-edition-01_covers.ai",
          assetType: "Design",
          tags: ["print"],
          createdBy: petra,
          createdAt: daysAgo(26),
          updatedAt: daysAgo(9),
          deliverableTitle: "Look book",
        },
        {
          versionNo: 2,
          label: "v2",
          source: "external_link",
          url: "https://www.dropbox.com/scl/fi/sable-covers-v2.ai",
          externalProvider: "Dropbox",
          mimeType: null,
          reviewStatus: "approved",
          submittedAt: daysAgo(10),
          createdAt: daysAgo(10),
          submitter: petra,
        },
        [
          { versionNo: 1, when: daysAgo(26), reviewStatus: null, url: "https://www.dropbox.com/scl/fi/sable-covers-v1.ai" },
        ]
      ),
      composeAsset(
        {
          id: "a-sb-2",
          filename: "fabric-swatch_scans.pdf",
          assetType: "Photography",
          tags: ["material"],
          createdBy: samir,
          createdAt: daysAgo(17),
          updatedAt: daysAgo(17),
          deliverableTitle: "Look book",
        },
        {
          versionNo: 1,
          label: "v1",
          source: "upload",
          url: "https://res.cloudinary.com/demo/image/upload/v1/sable/fabric-swatch_scans.pdf",
          externalProvider: null,
          mimeType: "application/pdf",
          reviewStatus: null,
          submittedAt: null,
          createdAt: daysAgo(17),
          submitter: samir,
        },
        []
      ),
    ],
  },
  {
    id: "f-signal",
    title: "Signal experiments",
    slug: "signal-experiments",
    updatedAt: daysAgo(2),
    assets: [],
  },
]

/** The mock viewer's initials — used only if a variant needs a "you" voice. */
export const MOCK_VIEWER = maya
