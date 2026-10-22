/**
 * Shared mock world for the folder-cutout concept sprint (local only —
 * nothing here touches the server).
 *
 * Shapes deliberately mirror the real lane payloads they will replace at
 * integration time: `MockDeliverable` ⇄ `DeliverableCard` + its tasks from
 * `TaskCard`, `MockVersion` ⇄ `VersionItem` (flattened from the
 * per-asset `DeliverableVersionsResult` nesting with `assetLabel` carried),
 * `MockComment` ⇄ `VersionThreadMessage`. The winning variant wires to the
 * real queries by swapping data in, not by reshaping the component.
 *
 * House bans honoured: no borders, no spinners — the sprint communicates
 * through washes, spacing, dots and text tone.
 */
import { avatarTint } from "@/lib/avatar-tint"

export type DeliverableStatus =
  | "planned"
  | "in_progress"
  | "blocked"
  | "ready_for_review"
  | "changes_requested"
  | "completed"

export type TaskStatus =
  "backlog" | "todo" | "in_progress" | "done" | "approved"
export type TaskPriority = "low" | "medium" | "high" | "urgent"
export type ReviewStatus =
  "submitted" | "approved" | "rejected" | "changes_requested" | "superseded"

export interface MockMember {
  teamId: string
  name: string
  email: string
}

export interface MockTask {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  dueDate: string | null
  overdue: boolean
  assignees: MockMember[]
}

export interface MockComment {
  id: string
  author: MockMember
  createdAt: Date
  body: string
}

export interface MockVersion {
  id: string
  /** Flattened asset hint, e.g. "hero-loop.mp4" — real data has this per-asset. */
  assetLabel: string
  versionNo: number
  label: string
  sourceLabel: string
  url: string
  /** null = draft, never submitted for review. */
  reviewStatus: ReviewStatus | null
  isLatest: boolean
  isLatestApproved: boolean
  submitter: { name: string | null }
  submitterNotes: string | null
  createdAt: Date
  feedback: MockComment[]
  decision: {
    kind: "approved" | "rejected" | "changes_requested"
    by: string | null
    at: Date
    note: string | null
  } | null
}

export interface MockDeliverable {
  id: string
  title: string
  description: string | null
  status: DeliverableStatus
  /** Date-only string, or null; `overdue` is server-stamped in real data. */
  deadline: string | null
  overdue: boolean
  owner: MockMember | null
  tasks: MockTask[]
  /** The deliverable's own discussion thread (not a version's). */
  comments: MockComment[]
  versions: MockVersion[]
}

/* ---------------------------------- time --------------------------------- */

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
}

function iso(offsetDays: number): string {
  return daysFromNow(offsetDays).toISOString().slice(0, 10)
}

function recent(offsetMinutes: number): Date {
  return new Date(Date.now() - offsetMinutes * 60 * 1000)
}

/* --------------------------------- people -------------------------------- */

export const MOCK_MEMBERS: MockMember[] = [
  { teamId: "m-1", name: "Maya Chen", email: "maya@studio.example" },
  { teamId: "m-2", name: "Felix Odeh", email: "felix@studio.example" },
  { teamId: "m-3", name: "Petra Lindqvist", email: "petra@studio.example" },
  { teamId: "m-4", name: "Samir Haddad", email: "samir@studio.example" },
  { teamId: "m-5", name: "June Park", email: "june@studio.example" },
  { teamId: "m-6", name: "Rita Alvarez", email: "rita@studio.example" },
]

const maya = MOCK_MEMBERS[0]
const felix = MOCK_MEMBERS[1]
const petra = MOCK_MEMBERS[2]
const samir = MOCK_MEMBERS[3]
const june = MOCK_MEMBERS[4]
const rita = MOCK_MEMBERS[5]

/** The viewer the mock thread composes as. */
export const MOCK_VIEWER: MockMember = maya

/* -------------------------------- project -------------------------------- */

export const MOCK_PROJECT = {
  title: "Aurora — spring refresh",
}

/* ----------------------------- metadata dots ----------------------------- */

/** Filled dot + plain label — the chip's colour, without the chip box. */
export const DELIVERABLE_DOTS: Record<
  DeliverableStatus,
  { label: string; dot: string }
> = {
  planned: { label: "Planned", dot: "bg-muted-foreground/40" },
  in_progress: { label: "In progress", dot: "bg-sky-500" },
  blocked: { label: "Blocked", dot: "bg-red-500" },
  ready_for_review: { label: "Ready for review", dot: "bg-violet-500" },
  changes_requested: { label: "Changes requested", dot: "bg-amber-500" },
  completed: { label: "Completed", dot: "bg-emerald-500" },
}

export const TASK_DOTS: Record<TaskStatus, { label: string; dot: string }> = {
  backlog: { label: "Backlog", dot: "bg-muted-foreground/40" },
  todo: { label: "To do", dot: "bg-sky-500" },
  in_progress: { label: "In progress", dot: "bg-blue-500" },
  done: { label: "Done", dot: "bg-emerald-500" },
  approved: { label: "Approved", dot: "bg-violet-500" },
}

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
}

export const REVIEW_DOTS: Record<ReviewStatus, { label: string; dot: string }> =
  {
    submitted: { label: "In review", dot: "bg-blue-500" },
    approved: { label: "Approved", dot: "bg-emerald-500" },
    rejected: { label: "Rejected", dot: "bg-red-500" },
    changes_requested: { label: "Changes requested", dot: "bg-amber-500" },
    superseded: { label: "Superseded", dot: "bg-muted-foreground/40" },
  }

/* -------------------------------- helpers -------------------------------- */

export function initialsOf(name: string | null): string {
  const first = name?.trim()[0]
  return first ? first.toUpperCase() : "?"
}

/** Stable tint classes for a person, straight from the house tint pool. */
export function tintOf(member: MockMember): string {
  return avatarTint(member.teamId)
}

export function formatDueDate(date: string | null): string {
  if (!date) return ""
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(new Date(date))
}

/* ---------------------------------- data --------------------------------- */

export const MOCK_DELIVERABLES: MockDeliverable[] = [
  {
    id: "d-teaser",
    title: "Launch teaser video",
    description: "45s cut for the hero slot — needs a 15s alt for paid.",
    status: "in_progress",
    deadline: iso(12),
    overdue: false,
    owner: maya,
    tasks: [
      {
        id: "t-1",
        title: "Grade the drone pass",
        description:
          "Colour pass over the harbour shots, match the stills board.",
        status: "in_progress",
        priority: "high",
        dueDate: iso(4),
        overdue: false,
        assignees: [felix],
      },
      {
        id: "t-2",
        title: "Sound design pass",
        description: null,
        status: "todo",
        priority: "medium",
        dueDate: iso(7),
        overdue: false,
        assignees: [june, samir],
      },
      {
        id: "t-3",
        title: "Subtitle-free alt export",
        description:
          "For paid placements — subtitle-free export handled separately.",
        status: "backlog",
        priority: "low",
        dueDate: null,
        overdue: false,
        assignees: [],
      },
      {
        id: "t-4",
        title: "Storyboard lock",
        description: "Signed off at Monday's review.",
        status: "done",
        priority: "medium",
        dueDate: null,
        overdue: false,
        assignees: [maya],
      },
    ],
    comments: [
      {
        id: "c-1",
        author: petra,
        createdAt: recent(190),
        body: "Client asked whether the 45s cut can end on the logo sting instead of the tagline card — keep both in the edit for now.",
      },
      {
        id: "c-2",
        author: felix,
        createdAt: recent(140),
        body: "Drone pass is 80% graded. The harbour shots need the matching LUT from the stills board.",
      },
      {
        id: "c-3",
        author: maya,
        createdAt: recent(55),
        body: "Stills board LUT is in the shared drive → Aurora/grade. Ping me if the water shots won't take it.",
      },
    ],
    versions: [
      {
        id: "v-1",
        assetLabel: "aurora_teaser_45s.mp4",
        versionNo: 7,
        label: "v7",
        sourceLabel: "hosted upload",
        url: "#",
        reviewStatus: "superseded",
        isLatest: false,
        isLatestApproved: true,
        submitter: { name: "Maya Chen" },
        submitterNotes:
          "Structure locked: cold open → product reveal → tagline.",
        createdAt: recent(60 * 24 * 6),
        feedback: [
          {
            id: "c-v1-1",
            author: petra,
            createdAt: recent(60 * 24 * 5),
            body: "Approved. The pacing on the second beat finally works.",
          },
        ],
        decision: {
          kind: "approved",
          by: "Petra Lindqvist",
          at: recent(60 * 24 * 5),
          note: "Ship it as the structure reference.",
        },
      },
      {
        id: "v-2",
        assetLabel: "aurora_teaser_45s.mp4",
        versionNo: 8,
        label: "v8",
        sourceLabel: "hosted upload",
        url: "#",
        reviewStatus: "submitted",
        isLatest: true,
        isLatestApproved: false,
        submitter: { name: "Maya Chen" },
        submitterNotes: "New grade + sound pass in. Duration still 45s.",
        createdAt: recent(300),
        feedback: [
          {
            id: "c-v2-1",
            author: june,
            createdAt: recent(240),
            body: "Water reflections look doubled in shot 4 — might be the denoiser?",
          },
          {
            id: "c-v2-2",
            author: petra,
            createdAt: recent(90),
            body: "Grade is gorgeous. Fix the shot-4 artefact and this is an approve.",
          },
        ],
        decision: null,
      },
    ],
  },
  {
    id: "d-copy",
    title: "Landing page copy",
    description:
      "Hero, features and FAQ — generation 2 shipped to the review board.",
    status: "ready_for_review",
    deadline: iso(-3),
    overdue: true,
    owner: rita,
    tasks: [
      {
        id: "t-5",
        title: "Tighten FAQ to 8 entries",
        description: null,
        status: "done",
        priority: "medium",
        dueDate: null,
        overdue: false,
        assignees: [rita],
      },
      {
        id: "t-6",
        title: "Legal read of the claims block",
        description: "Compliance wants the retention claim softened.",
        status: "in_progress",
        priority: "urgent",
        dueDate: iso(-1),
        overdue: true,
        assignees: [samir],
      },
    ],
    comments: [
      {
        id: "c-4",
        author: samir,
        createdAt: recent(1200),
        body: "Retention claim softened to 'learns from your routines' — full legal text pending.",
      },
      {
        id: "c-5",
        author: rita,
        createdAt: recent(300),
        body: "Copy deck v3 is up for review. FAQ is at 7 — one entry merged.",
      },
    ],
    versions: [
      {
        id: "v-3",
        assetLabel: "landing-copy-v3.gdoc",
        versionNo: 3,
        label: "v3",
        sourceLabel: "external link (Google Docs)",
        url: "#",
        reviewStatus: "submitted",
        isLatest: true,
        isLatestApproved: false,
        submitter: { name: "Rita Alvarez" },
        submitterNotes: "FAQ merged to 7 entries; claims softened per legal.",
        createdAt: recent(320),
        feedback: [
          {
            id: "c-v3-1",
            author: maya,
            createdAt: recent(200),
            body: "Reads much cleaner. The hero line still feels two words long.",
          },
        ],
        decision: null,
      },
    ],
  },
  {
    id: "d-presskit",
    title: "Press kit PDF",
    description:
      "Boilerplate, founder bios, product stills — for the outreach batch.",
    status: "planned",
    deadline: iso(20),
    overdue: false,
    owner: null,
    tasks: [
      {
        id: "t-7",
        title: "Collect approved founder bios",
        description: null,
        status: "backlog",
        priority: "low",
        dueDate: null,
        overdue: false,
        assignees: [],
      },
    ],
    comments: [
      {
        id: "c-6",
        author: petra,
        createdAt: recent(60 * 26),
        body: "Waiting on the final founder portraits before this one can start.",
      },
    ],
    versions: [],
  },
  {
    id: "d-social",
    title: "Social asset pack",
    description: "9 tiles + story frames from the approved key art.",
    status: "completed",
    deadline: iso(-9),
    overdue: false,
    owner: june,
    tasks: [
      {
        id: "t-8",
        title: "Export 9 square tiles",
        description: null,
        status: "approved",
        priority: "medium",
        dueDate: null,
        overdue: false,
        assignees: [june],
      },
      {
        id: "t-9",
        title: "Story frames with safe zones",
        description: null,
        status: "approved",
        priority: "low",
        dueDate: null,
        overdue: false,
        assignees: [june],
      },
    ],
    comments: [
      {
        id: "c-7",
        author: maya,
        createdAt: recent(60 * 24 * 11),
        body: "Tiles approved and shipped to the social calendar. Closing this out.",
      },
    ],
    versions: [
      {
        id: "v-4",
        assetLabel: "social_tiles_9.pdf",
        versionNo: 2,
        label: "v2",
        sourceLabel: "hosted upload",
        url: "#",
        reviewStatus: "approved",
        isLatest: true,
        isLatestApproved: true,
        submitter: { name: "June Park" },
        submitterNotes: "Alpha channel fixed on the logo lockups.",
        createdAt: recent(60 * 24 * 12),
        feedback: [],
        decision: {
          kind: "approved",
          by: "Maya Chen",
          at: recent(60 * 24 * 11),
          note: null,
        },
      },
    ],
  },
  {
    id: "d-email",
    title: "Email nurture sequence",
    description: "Three sends across the first two weeks on trial.",
    status: "in_progress",
    deadline: iso(-2),
    overdue: true,
    owner: felix,
    tasks: [
      {
        id: "t-10",
        title: "Draft send #2 — onboarding tips",
        description: null,
        status: "in_progress",
        priority: "high",
        dueDate: iso(-1),
        overdue: true,
        assignees: [felix],
      },
      {
        id: "t-11",
        title: "Merge tags QA against test list",
        description: null,
        status: "todo",
        priority: "medium",
        dueDate: iso(3),
        overdue: false,
        assignees: [june, rita],
      },
    ],
    comments: [
      {
        id: "c-8",
        author: felix,
        createdAt: recent(60 * 8),
        body: "Send #2 draft in the doc — the pacing issue is the CTA arriving too late.",
      },
      {
        id: "c-9",
        author: rita,
        createdAt: recent(60 * 3),
        body: "Move the CTA under the second section; trial users skim.",
      },
    ],
    versions: [
      {
        id: "v-5",
        assetLabel: "nurture_sequence_v1.eml",
        versionNo: 1,
        label: "v1",
        sourceLabel: "hosted upload",
        url: "#",
        reviewStatus: "changes_requested",
        isLatest: true,
        isLatestApproved: false,
        submitter: { name: "Felix Odeh" },
        submitterNotes: "First full draft, merge tags placeholder.",
        createdAt: recent(60 * 9),
        feedback: [
          {
            id: "c-v5-1",
            author: petra,
            createdAt: recent(60 * 8),
            body: "CTA placement, please — and the subject line duplicates send #1.",
          },
          {
            id: "c-v5-2",
            author: maya,
            createdAt: recent(60 * 7),
            body: "Seconded on the subject lines. Everything else reads well.",
          },
        ],
        decision: {
          kind: "changes_requested",
          by: "Petra Lindqvist",
          at: recent(60 * 7),
          note: "Subject line duplication + CTA placement.",
        },
      },
    ],
  },
]
