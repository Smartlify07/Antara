/* eslint-disable @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unnecessary-type-assertion -- Drizzle types row-returning inserts as always present; these guards protect this one-off seed against a write that returns no row. */
/**
 * Curated demo data for screen recordings.
 *
 * Creates (or rebuilds) the "Northlight Studio" workspace owned by a demo
 * account, with enough projects, deliverables, versions, requests and
 * notifications for a full product tour to look like real work.
 *
 * Safe to re-run: it wipes only the workspace whose slug is `northlight`, then
 * rebuilds it. It never touches other workspaces.
 *
 * Usage: `pnpm db:seed:tour` (or `doppler run -c dev -- tsx scripts/seed-demo-tour.ts`)
 */
import { eq, sql } from "drizzle-orm"
import { hashPassword } from "better-auth/crypto"
import { db, pool } from "@/db"
import { seedWorkspaceRoles } from "@/db/seed"
import { tagColorFor } from "@/lib/tag-colors"
import {
  account,
  approvals,
  assetVersions,
  assets,
  comments,
  deliverables,
  projectMembers,
  projectTags,
  projectUpdates,
  projects,
  requests,
  statusHistory,
  tags,
  taskAssignees,
  tasks,
  team,
  user,
  workspaces,
} from "@/db/schema/index"
import { notifications } from "@/db/schema/notifications"
import type {
  DeliverableStatus,
  ProjectStatus,
  RequestTriageStatus,
  TaskPriority,
  TaskStatus,
  VersionReviewStatus,
} from "@/db/enums"

const DEMO_SLUG = "northlight"
const DEMO_EMAIL = "ada@northlight.studio"
const DEMO_PASSWORD = "AntaraDemo1!"
const DEMO_NAME = "Ada Osei"

const DAY = 24 * 60 * 60 * 1000

function daysFromNow(days: number, hour = 10): Date {
  const date = new Date(Date.now() + days * DAY)
  date.setHours(hour, 0, 0, 0)
  return date
}

interface Person {
  email: string
  name: string
}

const TEAM: Person[] = [
  { email: "kai@northlight.studio", name: "Kai Mensah" },
  { email: "rae@northlight.studio", name: "Rae Lindqvist" },
  { email: "tom@northlight.studio", name: "Tom Okafor" },
]

interface SeedVersion {
  versionNo: number
  label: string
  note: string
  reviewStatus: VersionReviewStatus | null
  submittedInDays: number | null
  externalProvider: string
  mimeType: string
  sizeBytes: number
  by: "ada" | "kai" | "rae" | "tom"
}

interface SeedAsset {
  filename: string
  assetType: string
  tags: string[]
  deliverable: string
  versions: SeedVersion[]
}

interface SeedDeliverable {
  title: string
  description: string
  type: string
  status: DeliverableStatus
  owner: "ada" | "kai" | "rae" | "tom"
  deadlineInDays: number | null
}

interface SeedTask {
  title: string
  status: TaskStatus
  priority: TaskPriority
  dueInDays: number | null
  assignees: Array<"ada" | "kai" | "rae" | "tom">
  deliverable?: string
}

interface SeedProject {
  slug: string
  title: string
  description: string
  status: ProjectStatus
  startInDays: number
  deadlineInDays: number | null
  gradient: string
  tagLabels: string[]
  members: Array<"ada" | "kai" | "rae" | "tom">
  deliverables: SeedDeliverable[]
  tasks: SeedTask[]
  assets: SeedAsset[]
}

const PROJECTS: SeedProject[] = [
  {
    slug: "aurora-campaign",
    title: "Aurora Campaign",
    description:
      "Multi-channel launch for the Aurora sneaker line — key visual, social cut and out-of-home.",
    status: "active",
    startInDays: -34,
    deadlineInDays: 12,
    gradient: "oklch(0.72 0.19 350)",
    tagLabels: ["Branding", "Motion", "Web Design"],
    members: ["ada", "kai", "rae"],
    deliverables: [
      {
        title: "Hero key visual",
        description: "Master artwork and two crops for web and retail.",
        type: "Art direction",
        status: "in_progress",
        owner: "rae",
        deadlineInDays: 4,
      },
      {
        title: "30s social edit",
        description: "Vertical cut for paid social, captioned.",
        type: "Film",
        status: "ready_for_review",
        owner: "kai",
        deadlineInDays: 2,
      },
      {
        title: "Billboard artwork",
        description: "48-sheet OOH artwork, CMYK safe.",
        type: "Print",
        status: "changes_requested",
        owner: "rae",
        deadlineInDays: -1,
      },
    ],
    tasks: [
      {
        title: "Grade the hero frame after client notes",
        status: "in_progress",
        priority: "urgent",
        dueInDays: 1,
        assignees: ["rae"],
        deliverable: "Hero key visual",
      },
      {
        title: "Cut 9:16 captioned variant",
        status: "done",
        priority: "high",
        dueInDays: -2,
        assignees: ["kai"],
        deliverable: "30s social edit",
      },
      {
        title: "Check OOH bleed and safe area",
        status: "todo",
        priority: "medium",
        dueInDays: 2,
        assignees: ["ada", "rae"],
        deliverable: "Billboard artwork",
      },
      {
        title: "Book the retoucher for week 2",
        status: "backlog",
        priority: "low",
        dueInDays: 7,
        assignees: ["ada"],
      },
    ],
    assets: [
      {
        filename: "aurora-hero-key-visual.png",
        assetType: "Image",
        tags: ["key visual", "final"],
        deliverable: "Hero key visual",
        versions: [
          {
            versionNo: 1,
            label: "v1",
            note: "First pass on the runner silhouette.",
            reviewStatus: "superseded",
            submittedInDays: -8,
            externalProvider: "figma",
            mimeType: "image/png",
            sizeBytes: 18_400_000,
            by: "rae",
          },
          {
            versionNo: 2,
            label: "v2",
            note: "Warmer grade, new type lockup. Sent for review.",
            reviewStatus: "submitted",
            submittedInDays: -1,
            externalProvider: "figma",
            mimeType: "image/png",
            sizeBytes: 21_200_000,
            by: "rae",
          },
        ],
      },
      {
        filename: "aurora-social-30s.mp4",
        assetType: "Video",
        tags: ["social", "edit"],
        deliverable: "30s social edit",
        versions: [
          {
            versionNo: 1,
            label: "v1",
            note: "Captioned 9:16 cut, music cleared.",
            reviewStatus: "submitted",
            submittedInDays: -2,
            externalProvider: "google_drive",
            mimeType: "video/mp4",
            sizeBytes: 96_500_000,
            by: "kai",
          },
        ],
      },
      {
        filename: "aurora-billboard.pdf",
        assetType: "Print",
        tags: ["ooh"],
        deliverable: "Billboard artwork",
        versions: [
          {
            versionNo: 1,
            label: "v1",
            note: "48-sheet, 6mm bleed. CMYK proof attached in thread.",
            reviewStatus: "changes_requested",
            submittedInDays: -4,
            externalProvider: "dropbox",
            mimeType: "application/pdf",
            sizeBytes: 34_100_000,
            by: "rae",
          },
        ],
      },
    ],
  },
  {
    slug: "northwind-rebrand",
    title: "Northwind Rebrand",
    description:
      "Identity refresh across wordmark, palette and guidelines for a 40-year-old logistics brand.",
    status: "active",
    startInDays: -21,
    deadlineInDays: 34,
    gradient: "oklch(0.73 0.18 300)",
    tagLabels: ["Branding", "Product Design"],
    members: ["ada", "tom", "rae"],
    deliverables: [
      {
        title: "Identity system",
        description: "Wordmark, monogram, palette and type scale.",
        type: "Brand identity",
        status: "in_progress",
        owner: "tom",
        deadlineInDays: 18,
      },
      {
        title: "Brand guidelines",
        description: "Applied rules, do/don't spreads, motion principles.",
        type: "Guidelines",
        status: "planned",
        owner: "ada",
        deadlineInDays: 30,
      },
    ],
    tasks: [
      {
        title: "Wordmark spacing at small sizes",
        status: "done",
        priority: "high",
        dueInDays: -3,
        assignees: ["tom"],
        deliverable: "Identity system",
      },
      {
        title: "Test palette on wayfinding mockups",
        status: "in_progress",
        priority: "medium",
        dueInDays: 5,
        assignees: ["tom", "rae"],
        deliverable: "Identity system",
      },
      {
        title: "Draft the guidelines contents page",
        status: "backlog",
        priority: "low",
        dueInDays: 16,
        assignees: ["ada"],
        deliverable: "Brand guidelines",
      },
    ],
    assets: [
      {
        filename: "northwind-wordmark.svg",
        assetType: "Vector",
        tags: ["wordmark", "approved"],
        deliverable: "Identity system",
        versions: [
          {
            versionNo: 1,
            label: "v1",
            note: "Optical spacing corrected at 16px.",
            reviewStatus: "approved",
            submittedInDays: -6,
            externalProvider: "figma",
            mimeType: "image/svg+xml",
            sizeBytes: 48_000,
            by: "tom",
          },
        ],
      },
    ],
  },
  {
    slug: "lumen-launch",
    title: "Lumen Product Launch",
    description:
      "Teaser film and landing page for the Lumen desk lamp, shipped last month.",
    status: "completed",
    startInDays: -96,
    deadlineInDays: -10,
    gradient: "oklch(0.72 0.16 250)",
    tagLabels: ["Motion", "Photography", "Copywriting"],
    members: ["ada", "kai"],
    deliverables: [
      {
        title: "Teaser film",
        description: "45s hero film, 16:9 and 9:16 masters.",
        type: "Film",
        status: "completed",
        owner: "kai",
        deadlineInDays: -14,
      },
      {
        title: "Landing page",
        description: "Launch page with scroll-driven product reveal.",
        type: "Web",
        status: "completed",
        owner: "ada",
        deadlineInDays: -11,
      },
    ],
    tasks: [
      {
        title: "Final colour pass on the film",
        status: "approved",
        priority: "high",
        dueInDays: -16,
        assignees: ["kai"],
        deliverable: "Teaser film",
      },
      {
        title: "Ship landing page",
        status: "approved",
        priority: "medium",
        dueInDays: -11,
        assignees: ["ada"],
        deliverable: "Landing page",
      },
    ],
    assets: [
      {
        filename: "lumen-teaser-master.mp4",
        assetType: "Video",
        tags: ["master", "hero"],
        deliverable: "Teaser film",
        versions: [
          {
            versionNo: 1,
            label: "v1",
            note: "Approved master. Colour and sound delivered.",
            reviewStatus: "approved",
            submittedInDays: -16,
            externalProvider: "google_drive",
            mimeType: "video/mp4",
            sizeBytes: 248_000_000,
            by: "kai",
          },
        ],
      },
    ],
  },
  {
    slug: "field-notes-editorial",
    title: "Field Notes Editorial",
    description:
      "Issue 04 of the studio journal — long-form photography and commissioned essays.",
    status: "on_hold",
    startInDays: -12,
    deadlineInDays: 21,
    gradient: "oklch(0.80 0.16 130)",
    tagLabels: ["Copywriting", "Photography"],
    members: ["ada", "rae"],
    deliverables: [
      {
        title: "Issue 04 cover",
        description: "Cover photograph and type treatment.",
        type: "Editorial",
        status: "blocked",
        owner: "rae",
        deadlineInDays: 9,
      },
    ],
    tasks: [
      {
        title: "Chase the cover photographer for selects",
        status: "todo",
        priority: "urgent",
        dueInDays: 1,
        assignees: ["rae"],
        deliverable: "Issue 04 cover",
      },
      {
        title: "Decide the essay order",
        status: "backlog",
        priority: "low",
        dueInDays: 12,
        assignees: ["ada"],
      },
    ],
    assets: [],
  },
  {
    slug: "solstice-packaging",
    title: "Solstice Packaging",
    description:
      "Structural and surface design for the Solstice refill range, printing in spring.",
    status: "planning",
    startInDays: -4,
    deadlineInDays: 48,
    gradient: "oklch(0.78 0.17 70)",
    tagLabels: ["Product Design", "Branding"],
    members: ["ada", "tom"],
    deliverables: [
      {
        title: "Packaging dielines",
        description: "Refill carton, sleeve and label dielines.",
        type: "Packaging",
        status: "ready_for_review",
        owner: "tom",
        deadlineInDays: 20,
      },
    ],
    tasks: [
      {
        title: "Print a white dummy of the refill carton",
        status: "in_progress",
        priority: "medium",
        dueInDays: 6,
        assignees: ["tom"],
        deliverable: "Packaging dielines",
      },
      {
        title: "Source recycled stock samples",
        status: "todo",
        priority: "low",
        dueInDays: 10,
        assignees: ["ada"],
      },
    ],
    assets: [
      {
        filename: "solstice-dielines.pdf",
        assetType: "Print",
        tags: ["dielines"],
        deliverable: "Packaging dielines",
        versions: [
          {
            versionNo: 1,
            label: "v1",
            note: "First dieline pass — glue flap still 3mm short.",
            reviewStatus: "submitted",
            submittedInDays: -1,
            externalProvider: "dropbox",
            mimeType: "application/pdf",
            sizeBytes: 12_700_000,
            by: "tom",
          },
        ],
      },
    ],
  },
  {
    slug: "meridian-app-teaser",
    title: "Meridian App Teaser",
    description:
      "15s product teaser for the Meridian app store listing and launch email.",
    status: "active",
    startInDays: -9,
    deadlineInDays: 5,
    gradient: "oklch(0.75 0.16 165)",
    tagLabels: ["Motion", "Product Design"],
    members: ["ada", "kai", "tom"],
    deliverables: [
      {
        title: "App teaser cut",
        description: "15s 9:16 teaser with UI motion.",
        type: "Film",
        status: "in_progress",
        owner: "kai",
        deadlineInDays: 3,
      },
    ],
    tasks: [
      {
        title: "Animate the dashboard transition",
        status: "in_progress",
        priority: "high",
        dueInDays: 2,
        assignees: ["kai"],
        deliverable: "App teaser cut",
      },
      {
        title: "Approve the end card type",
        status: "todo",
        priority: "medium",
        dueInDays: 3,
        assignees: ["ada"],
        deliverable: "App teaser cut",
      },
      {
        title: "Export the app store stills",
        status: "backlog",
        priority: "low",
        dueInDays: 4,
        assignees: ["tom"],
      },
    ],
    assets: [],
  },
]

const REQUEST_SEED: Array<{
  title: string
  brief: string
  category: string
  priority: TaskPriority
  triageStatus: RequestTriageStatus
  deadlineInDays: number | null
  projectSlug?: string
  by: "ada" | "kai" | "rae" | "tom"
}> = [
  {
    title: "Investor deck refresh for the Series A",
    brief:
      "We need the deck to look like the product does. 18 slides, mostly type and two product shots. Board meeting is the 28th.",
    category: "Presentation",
    priority: "urgent",
    triageStatus: "open",
    deadlineInDays: 6,
    by: "rae",
  },
  {
    title: "Spring drop landing page",
    brief:
      "A single scroll page for the spring capsule. Hero video, three product tiles, signup at the bottom. We can supply copy.",
    category: "Web",
    priority: "high",
    triageStatus: "open",
    deadlineInDays: 14,
    by: "tom",
  },
  {
    title: "Logo files in vector, please",
    brief:
      "Our printer keeps asking for an EPS. Can we get the wordmark in vector with clear space marked?",
    category: "Brand",
    priority: "medium",
    triageStatus: "needs_info",
    deadlineInDays: 3,
    by: "kai",
  },
  {
    title: "Podcast cover art — season two",
    brief:
      "Same format as season one, new guest portraits. Twelve episodes, delivered as 3000×3000 PNGs.",
    category: "Artwork",
    priority: "medium",
    triageStatus: "accepted",
    deadlineInDays: 20,
    projectSlug: "aurora-campaign",
    by: "tom",
  },
  {
    title: "Trade show booth graphics",
    brief:
      "3×3m booth, back wall plus two side panels. Show is in six weeks; we have the floor plan.",
    category: "Print",
    priority: "high",
    triageStatus: "declined",
    deadlineInDays: 40,
    by: "rae",
  },
  {
    title: "Social templates for the retail team",
    brief:
      "Six editable templates for store openings. The retail team works in Canva — anything that exports cleanly is fine.",
    category: "Social",
    priority: "low",
    triageStatus: "accepted",
    deadlineInDays: 26,
    projectSlug: "northwind-rebrand",
    by: "kai",
  },
]

const TAG_VOCABULARY = [
  "Branding",
  "Motion",
  "Web Design",
  "Product Design",
  "Photography",
  "Copywriting",
]

async function ensureDemoUser(): Promise<{ id: string; email: string; name: string }> {
  const existing = await db
    .select({ id: user.id, email: user.email, name: user.name })
    .from(user)
    .where(eq(user.email, DEMO_EMAIL))
    .limit(1)

  if (existing[0]) return existing[0]

  const [created] = await db
    .insert(user)
    .values({
      id: crypto.randomUUID(),
      name: DEMO_NAME,
      email: DEMO_EMAIL,
      emailVerified: true,
    })
    .returning({ id: user.id, email: user.email, name: user.name })

  if (!created) throw new Error("Could not create the demo user.")

  await db.insert(account).values({
    id: crypto.randomUUID(),
    accountId: created.id,
    providerId: "credential",
    userId: created.id,
    password: await hashPassword(DEMO_PASSWORD),
  })

  return created
}

async function ensureTeammate(person: Person) {
  const existing = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, person.email))
    .limit(1)
  if (existing[0]) return existing[0].id

  const [created] = await db
    .insert(user)
    .values({
      id: crypto.randomUUID(),
      name: person.name,
      email: person.email,
      emailVerified: true,
    })
    .returning({ id: user.id })
  if (!created) throw new Error(`Could not create ${person.name}.`)
  return created.id
}

async function wipeWorkspace() {
  const [existing] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.slug, DEMO_SLUG))
    .limit(1)
  if (!existing) return

  // Delete in dependency order. Cascades alone are not enough: `roles` is
  // referenced by `project_members`/`team` with RESTRICT, and Postgres is free
  // to reach `roles` before those rows during a workspace cascade.
  const id = existing.id
  await db.delete(approvals).where(eq(approvals.workspaceId, id))
  await db.delete(comments).where(eq(comments.workspaceId, id))
  await db.delete(notifications).where(eq(notifications.workspaceId, id))

  const statements = [
    sql`delete from asset_versions where asset_id in (select a.id from assets a join projects p on p.id = a.project_id where p.workspace_id = ${id})`,
    sql`delete from assets where project_id in (select id from projects where workspace_id = ${id})`,
    sql`delete from task_assignees where task_id in (select t.id from tasks t join projects p on p.id = t.project_id where p.workspace_id = ${id})`,
    sql`delete from status_history where task_id in (select t.id from tasks t join projects p on p.id = t.project_id where p.workspace_id = ${id})`,
    sql`delete from tasks where project_id in (select id from projects where workspace_id = ${id})`,
    sql`delete from deliverables where project_id in (select id from projects where workspace_id = ${id})`,
    sql`delete from project_members where project_id in (select id from projects where workspace_id = ${id})`,
    sql`delete from project_tags where project_id in (select id from projects where workspace_id = ${id})`,
    sql`delete from project_updates where project_id in (select id from projects where workspace_id = ${id})`,
    sql`delete from projects where workspace_id = ${id}`,
    sql`delete from requests where workspace_id = ${id}`,
    sql`delete from team where workspace_id = ${id}`,
    sql`delete from tags where workspace_id = ${id}`,
    sql`delete from roles where workspace_id = ${id}`,
    sql`delete from workspaces where id = ${id}`,
  ]
  for (const statement of statements) await db.execute(statement)
}

async function main() {
  const owner = await ensureDemoUser()
  const people = new Map<string, { userId: string; teamId: string }>()

  await wipeWorkspace()

  const [workspace] = await db
    .insert(workspaces)
    .values({
      slug: DEMO_SLUG,
      title: "Northlight Studio",
      description:
        "Brand, film and product design for teams that ship. Eleven people, six live projects.",
      ownerId: owner.id,
    })
    .returning()
  if (!workspace) throw new Error("Could not create the demo workspace.")

  const seededRoles = await seedWorkspaceRoles(db, workspace.id)
  const adminRoleId = seededRoles.admin!.id
  const memberRoleId = seededRoles.member!.id
  const leadRoleId = seededRoles.lead!.id
  const projectMemberRoleId = seededRoles.projectMember!.id

  const [ownerSeat] = await db
    .insert(team)
    .values({
      workspaceId: workspace.id,
      userId: owner.id,
      roleId: adminRoleId,
      status: "active",
      joinedAt: daysFromNow(-60),
    })
    .returning()
  if (!ownerSeat) throw new Error("Could not seat the owner.")
  people.set("ada", { userId: owner.id, teamId: ownerSeat.id })

  for (const person of TEAM) {
    const userId = await ensureTeammate(person)
    const [seat] = await db
      .insert(team)
      .values({
        workspaceId: workspace.id,
        userId,
        roleId: memberRoleId,
        status: "active",
        joinedAt: daysFromNow(-40),
      })
      .returning()
    if (!seat) throw new Error(`Could not seat ${person.name}.`)
    people.set(person.name.split(" ")[0]!.toLowerCase(), {
      userId,
      teamId: seat.id,
    })
  }

  const tagIds = new Map<string, string>()
  for (const label of TAG_VOCABULARY) {
    const [tag] = await db
      .insert(tags)
      .values({
        workspaceId: workspace.id,
        label,
        color: tagColorFor(label),
      })
      .returning()
    if (tag) tagIds.set(label, tag.id)
  }

  let notificationClock = 0
  const notify = async (input: {
    userId: string
    type: string
    subjectType: string
    subjectId: string
    actorId: string
    unread: boolean
    minutesAgo: number
  }) => {
    notificationClock += 1
    await db.insert(notifications).values({
      workspaceId: workspace.id,
      userId: input.userId,
      type: input.type,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      actorId: input.actorId,
      readAt: input.unread
        ? null
        : new Date(Date.now() - (input.minutesAgo - 30) * 60_000),
      createdAt: new Date(Date.now() - input.minutesAgo * 60_000),
    })
  }

  for (const seed of PROJECTS) {
    const [project] = await db
      .insert(projects)
      .values({
        workspaceId: workspace.id,
        slug: seed.slug,
        title: seed.title,
        description: seed.description,
        status: seed.status,
        startDate: daysFromNow(seed.startInDays),
        deadline:
          seed.deadlineInDays === null
            ? null
            : daysFromNow(seed.deadlineInDays),
        gradientStart: seed.gradient,
        gradientEnd: null,
        createdBy: owner.id,
      })
      .returning()
    if (!project) throw new Error(`Could not create ${seed.title}.`)

    for (const label of seed.tagLabels) {
      const tagId = tagIds.get(label)
      if (tagId) {
        await db.insert(projectTags).values({ projectId: project.id, tagId })
      }
    }

    const members = new Map<string, string>()
    for (const key of seed.members) {
      const person = people.get(key)
      if (!person) continue
      const [membership] = await db
        .insert(projectMembers)
        .values({
          projectId: project.id,
          userId: person.userId,
          roleId: key === "ada" || key === "tom" ? leadRoleId : projectMemberRoleId,
          status: "active",
          addedBy: owner.id,
        })
        .returning()
      if (membership) members.set(key, membership.id)
    }
    // Ensure every person the work names is a project member; roles for the
    // others were assigned above.
    for (const key of ["ada", "kai", "rae", "tom"] as const) {
      if (members.has(key)) continue
      const person = people.get(key)
      if (!person) continue
      const [membership] = await db
        .insert(projectMembers)
        .values({
          projectId: project.id,
          userId: person.userId,
          roleId: projectMemberRoleId,
          status: "active",
          addedBy: owner.id,
        })
        .returning()
      if (membership) members.set(key, membership.id)
    }

    const deliverableIds = new Map<string, string>()
    for (const seedDeliverable of seed.deliverables) {
      const ownerPerson = people.get(seedDeliverable.owner)
      const [deliverable] = await db
        .insert(deliverables)
        .values({
          workspaceId: workspace.id,
          projectId: project.id,
          title: seedDeliverable.title,
          description: seedDeliverable.description,
          type: seedDeliverable.type,
          ownerId: ownerPerson?.teamId ?? ownerSeat.id,
          productionStatus: seedDeliverable.status,
          deadline:
            seedDeliverable.deadlineInDays === null
              ? null
              : daysFromNow(seedDeliverable.deadlineInDays),
          createdBy: owner.id,
        })
        .returning()
      if (!deliverable) throw new Error("Could not create deliverable.")
      deliverableIds.set(seedDeliverable.title, deliverable.id)

      await notify({
        userId: ownerPerson?.userId ?? owner.id,
        type: "deliverable_assigned",
        subjectType: "deliverable",
        subjectId: deliverable.id,
        // Never notify a person about their own action; Ada's own
        // deliverables are framed as assigned by Rae.
        actorId:
          ownerPerson?.userId === owner.id
            ? people.get("rae")?.userId ?? owner.id
            : owner.id,
        unread: false,
        minutesAgo: 6 * 24 * 60 + seedDeliverable.title.length * 7,
      })
    }

    for (const seedTask of seed.tasks) {
      const [task] = await db
        .insert(tasks)
        .values({
          projectId: project.id,
          deliverableId: seedTask.deliverable
            ? deliverableIds.get(seedTask.deliverable) ?? null
            : null,
          title: seedTask.title,
          status: seedTask.status,
          priority: seedTask.priority,
          dueDate:
            seedTask.dueInDays === null ? null : daysFromNow(seedTask.dueInDays),
          createdBy: owner.id,
        })
        .returning()
      if (!task) throw new Error("Could not create task.")

      for (const assignee of seedTask.assignees) {
        const memberId = members.get(assignee)
        if (!memberId) continue
        await db.insert(taskAssignees).values({
          taskId: task.id,
          projectMemberId: memberId,
        })
        if (assignee !== "ada") {
          await notify({
            userId: people.get(assignee)?.userId ?? owner.id,
            type: "task_assigned",
            subjectType: "task",
            subjectId: task.id,
            actorId: owner.id,
            unread: false,
            minutesAgo: 5 * 24 * 60 + seedTask.title.length,
          })
        }
      }

      if (
        seedTask.status === "done" ||
        seedTask.status === "approved" ||
        seedTask.status === "in_progress"
      ) {
        await db.insert(statusHistory).values({
          taskId: task.id,
          fromStatus: "todo",
          toStatus: seedTask.status,
          changedBy: owner.id,
          changedAt: daysFromNow(-2, 14),
        })
      }

      if (seedTask.assignees.includes("ada")) {
        await notify({
          userId: owner.id,
          type: "task_assigned",
          subjectType: "task",
          subjectId: task.id,
          actorId: people.get("kai")?.userId ?? owner.id,
          unread: false,
          minutesAgo: 40 + notificationClock * 37,
        })
      }
    }

    for (const seedAsset of seed.assets) {
      const [asset] = await db
        .insert(assets)
        .values({
          projectId: project.id,
          deliverableId: deliverableIds.get(seedAsset.deliverable) ?? null,
          filename: seedAsset.filename,
          assetType: seedAsset.assetType,
          tags: seedAsset.tags,
          createdBy: owner.id,
        })
        .returning()
      if (!asset) throw new Error("Could not create asset.")

      for (const version of seedAsset.versions) {
        const [update] = await db
          .insert(projectUpdates)
          .values({
            projectId: project.id,
            authorId: people.get(version.by)?.userId ?? owner.id,
            body: version.note,
            kind: "comment",
            createdAt: daysFromNow(
              version.submittedInDays === null ? -3 : version.submittedInDays,
              15
            ),
          })
          .returning()
        if (!update) throw new Error("Could not create version update.")

        const [created] = await db
          .insert(assetVersions)
          .values({
            assetId: asset.id,
            updateId: update.id,
            versionNo: version.versionNo,
            label: version.label,
            source: "external_link",
            provider: null,
            providerKey: null,
            url:
              version.externalProvider === "figma"
                ? "https://www.figma.com/design/8fJ2mQn4/aurora"
                : version.externalProvider === "dropbox"
                  ? "https://www.dropbox.com/s/8fJ2mQn4/file"
                  : "https://drive.google.com/file/d/8fJ2mQn4/view",
            externalProvider: version.externalProvider,
            externalFileId: `8fJ2mQn4-${seedAsset.filename}`,
            submitterNotes: version.note,
            reviewStatus: version.reviewStatus,
            submittedAt:
              version.submittedInDays === null
                ? null
                : daysFromNow(version.submittedInDays, 15),
            mimeType: version.mimeType,
            sizeBytes: version.sizeBytes,
            uploadedBy: people.get(version.by)?.userId ?? owner.id,
            createdAt: daysFromNow(
              version.submittedInDays === null ? -3 : version.submittedInDays,
              15
            ),
          })
          .returning()
        if (!created) throw new Error("Could not create version.")

        if (version.reviewStatus === "approved") {
          await db.insert(approvals).values({
            workspaceId: workspace.id,
            assetVersionId: created.id,
            approverId: owner.id,
            decision: "approved",
            comment: "Locked. Ship it.",
            decidedAt: daysFromNow((version.submittedInDays ?? -5) + 1, 11),
          })
        }

        if (version.reviewStatus === "changes_requested") {
          await db.insert(approvals).values({
            workspaceId: workspace.id,
            assetVersionId: created.id,
            approverId: owner.id,
            decision: "rejected",
            comment:
              "Copy is too close to the trim on the right panel — give it 12mm.",
            decidedAt: daysFromNow((version.submittedInDays ?? -4) + 1, 11),
          })
          await db.insert(comments).values({
            workspaceId: workspace.id,
            authorId: owner.id,
            subjectType: "version",
            subjectId: created.id,
            body: "The right panel copy needs 12mm more breathing room. Everything else is signed off.",
            createdAt: daysFromNow((version.submittedInDays ?? -4) + 1, 11),
          })
        }

        if (version.reviewStatus === "submitted") {
          await notify({
            userId: owner.id,
            type: "version_review_requested",
            subjectType: "asset_version",
            subjectId: created.id,
            actorId: people.get(version.by)?.userId ?? owner.id,
            unread: true,
            minutesAgo: 12 + seedAsset.filename.length,
          })
        }

        if (version.reviewStatus === "changes_requested") {
          await notify({
            userId: people.get(version.by)?.userId ?? owner.id,
            type: "version_review_changes_requested",
            subjectType: "asset_version",
            subjectId: created.id,
            actorId: owner.id,
            unread: true,
            minutesAgo: 90,
          })
        }

        if (version.reviewStatus === "approved") {
          await notify({
            userId: people.get(version.by)?.userId ?? owner.id,
            type: "version_review_approved",
            subjectType: "asset_version",
            subjectId: created.id,
            actorId: owner.id,
            unread: true,
            minutesAgo: 180,
          })
        }
      }
    }

    // A couple of feed posts so each project reads as alive.
    await db.insert(projectUpdates).values([
      {
        projectId: project.id,
        authorId: owner.id,
        body:
          seed.status === "completed"
            ? "Delivered and archived. Thanks everyone."
            : "Kickoff done — scope and dates are in the brief. Shout if anything looks off.",
        kind: "progress_update",
        createdAt: daysFromNow(seed.startInDays + 1, 9),
      },
      {
        projectId: project.id,
        authorId: people.get("kai")?.userId ?? owner.id,
        body: "Uploaded the latest pass to the work cabinet. Notes welcome.",
        kind: "comment",
        createdAt: daysFromNow(-2, 16),
      },
    ])
  }

  // Requests live at workspace level and may point at an accepted project.
  const projectBySlug = new Map(
    (
      await db
        .select({ id: projects.id, slug: projects.slug })
        .from(projects)
        .where(eq(projects.workspaceId, workspace.id))
    ).map((row) => [row.slug, row.id])
  )

  for (const seed of REQUEST_SEED) {
    const [request] = await db
      .insert(requests)
      .values({
        workspaceId: workspace.id,
        requesterId: people.get(seed.by)?.userId ?? owner.id,
        title: seed.title,
        brief: seed.brief,
        category: seed.category,
        priority: seed.priority,
        desiredDeadline:
          seed.deadlineInDays === null ? null : daysFromNow(seed.deadlineInDays),
        triageStatus: seed.triageStatus,
        projectId: seed.projectSlug
          ? projectBySlug.get(seed.projectSlug) ?? null
          : null,
        referenceLinks: seed.projectSlug
          ? ["https://www.notion.so/northlight/brief"]
          : null,
      })
      .returning()
    if (!request) throw new Error("Could not create request.")
  }

  const firstProject = await db
    .select({ id: projects.id, title: projects.title })
    .from(projects)
    .where(eq(projects.workspaceId, workspace.id))
    .limit(1)

  await notify({
    userId: owner.id,
    type: "project_assigned",
    subjectType: "project",
    subjectId: firstProject[0]?.id ?? workspace.id,
    actorId: people.get("rae")?.userId ?? owner.id,
    unread: true,
    minutesAgo: 35,
  })

  console.log("\nDemo tour data ready.")
  console.log(`  workspace  /w/${DEMO_SLUG}/projects`)
  console.log(`  email      ${DEMO_EMAIL}`)
  console.log(`  password   ${DEMO_PASSWORD}`)
  console.log(`  team seats ${people.size}`)
}

async function run() {
  await main()
  await pool.end()
}

run().catch(async (error) => {
  console.error(error)
  await pool.end()
  process.exitCode = 1
})

