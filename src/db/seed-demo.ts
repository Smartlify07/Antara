/**
 * Demo data for local development.
 *
 * Seeds one workspace with projects, tasks, assignments and status history
 * so the overview, attention panels, and project cards have something real to
 * render. Opt-in only: run `pnpm db:seed:demo`.
 *
 * It writes to whatever DATABASE_URL_UNPOOLED points at — do not run it
 * against a database you care about.
 */
import { and, eq } from "drizzle-orm"
import { db, pool } from "@/db"
import { seedWorkspaceRoles } from "@/db/seed"
import {
  projectMembers,
  projects,
  projectTags,
  roles,
  statusHistory,
  tags,
  taskAssignees,
  tasks,
  team,
  user,
  workspaces,
} from "@/db/schema/index"
import type { ProjectStatus, TaskPriority, TaskStatus } from "@/db/enums"

const DEMO_SLUG = "demo-studio"

const DAY = 24 * 60 * 60 * 1000

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * DAY)
}

interface SeedTask {
  title: string
  status: TaskStatus
  priority: TaskPriority
  dueInDays: number | null
  /** Emits a status transition so the activity feed has content. */
  transitionedTo?: TaskStatus
}

interface SeedProject {
  slug: string
  title: string
  description: string
  status: ProjectStatus
  deadlineInDays: number | null
  gradient: { start: string; end: string | null }
  tagLabels: string[]
  tasks: SeedTask[]
}

/** Workspace tag vocabulary, reused across projects. */
const TAG_VOCABULARY = [
  "Web Design",
  "Product Design",
  "Branding",
  "Motion",
  "Photography",
  "Copywriting",
]

/**
 * Bright CSS colors, one per project. Kept in a single lightness band so
 * the cards read as a set rather than a random assortment.
 */
const GRADIENTS = [
  { start: "oklch(0.72 0.19 350)", end: null }, // pink
  { start: "oklch(0.74 0.17 25)", end: null }, // coral
  { start: "oklch(0.80 0.16 130)", end: null }, // lime
  { start: "oklch(0.73 0.18 300)", end: null }, // violet
  { start: "oklch(0.75 0.16 165)", end: null }, // teal
  { start: "oklch(0.72 0.16 250)", end: null }, // blue
  { start: "oklch(0.76 0.18 15)", end: null }, // red
  { start: "oklch(0.78 0.17 70)", end: null }, // amber
]

const SEED_PROJECTS: SeedProject[] = [
  {
    slug: "aurora-campaign",
    title: "Aurora Campaign",
    description: "Multi-channel launch for the Aurora sneaker line.",
    status: "active",
    deadlineInDays: 12,
    gradient: GRADIENTS[0]!, // pink
    tagLabels: ["Web Design", "Branding", "Motion"],
    tasks: [
      {
        title: "Hero key visual — final colour pass",
        status: "done",
        priority: "urgent",
        dueInDays: -3,
        transitionedTo: "done",
      },
      {
        title: "Cut 30s social edit",
        status: "done",
        priority: "high",
        dueInDays: -1,
        transitionedTo: "done",
      },
      {
        title: "Billboard artwork export",
        status: "in_progress",
        priority: "high",
        dueInDays: -2,
        transitionedTo: "in_progress",
      },
      {
        title: "Press kit copy review",
        status: "todo",
        priority: "medium",
        dueInDays: 2,
      },
      {
        title: "Retail partner toolkit",
        status: "backlog",
        priority: "low",
        dueInDays: 9,
      },
    ],
  },
  {
    slug: "brand-refresh",
    title: "Northwind Rebrand",
    description: "Identity refresh across logo, palette, and guidelines.",
    status: "planning",
    deadlineInDays: 45,
    gradient: GRADIENTS[3]!, // violet
    tagLabels: ["Branding", "Product Design"],
    tasks: [
      {
        title: "Logo exploration round two",
        status: "in_progress",
        priority: "medium",
        dueInDays: 4,
        transitionedTo: "in_progress",
      },
      {
        title: "Type specimen sheet",
        status: "todo",
        priority: "low",
        dueInDays: 14,
      },
    ],
  },
  {
    slug: "lumen-launch",
    title: "Lumen Product Launch",
    description: "Teaser film and landing page for the Lumen desk lamp.",
    status: "completed",
    deadlineInDays: -10,
    gradient: GRADIENTS[5]!, // blue
    tagLabels: ["Motion", "Photography", "Copywriting"],
    tasks: [
      {
        title: "Teaser film master",
        status: "approved",
        priority: "high",
        dueInDays: -12,
        transitionedTo: "approved",
      },
      {
        title: "Landing page build handoff",
        status: "approved",
        priority: "medium",
        dueInDays: -11,
        transitionedTo: "approved",
      },
    ],
  },
]

async function pickUser() {
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
    })
    .from(user)
    .orderBy(user.createdAt)
    .limit(1)

  const picked = rows[0]
  if (!picked) {
    throw new Error(
      "No users found. Sign up through the app first, then re-run the seed."
    )
  }
  return picked
}

async function resolveWorkspace(ownerId: string) {
  const existing = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.slug, DEMO_SLUG))
    .limit(1)

  const found = existing[0]
  if (found) {
    console.log(`• Reusing workspace "${found.title}" (${found.id})`)
    const [lead] = await db
      .select()
      .from(roles)
      .where(eq(roles.workspaceId, found.id))
      .limit(1)
    if (!lead) throw new Error("Existing demo workspace has no roles.")
    return { workspace: found, leadRoleId: lead.id }
  }

  const [workspace] = await db
    .insert(workspaces)
    .values({
      slug: DEMO_SLUG,
      title: "Demo Studio",
      description: "Seeded workspace for local UI work.",
      ownerId,
    })
    .returning()

  if (!workspace) throw new Error("Failed to create demo workspace.")

  const seeded = await seedWorkspaceRoles(db, workspace.id)
  const leadRoleId = seeded.lead?.id
  if (!leadRoleId) throw new Error("Failed to seed roles.")

  await db.insert(team).values({
    workspaceId: workspace.id,
    userId: ownerId,
    roleId: seeded.admin!.id,
    status: "active",
    joinedAt: new Date(),
  })

  console.log(`• Created workspace "${workspace.title}" (${workspace.id})`)
  return { workspace, leadRoleId }
}

async function ensureWorkspaceTags(workspaceId: string) {
  const existing = await db
    .select()
    .from(tags)
    .where(eq(tags.workspaceId, workspaceId))

  const byLabel = new Map(existing.map((row) => [row.label, row]))

  for (const label of TAG_VOCABULARY) {
    if (byLabel.has(label)) continue
    const [created] = await db
      .insert(tags)
      .values({ workspaceId, label })
      .returning()
    if (created) byLabel.set(label, created)
  }

  return byLabel
}

async function ensureProjectTags(
  projectId: string,
  labels: string[],
  tagIds: Map<string, { id: string }>
) {
  for (const label of labels) {
    const tagId = tagIds.get(label)?.id
    if (!tagId) continue
    const existing = await db
      .select({ tagId: projectTags.tagId })
      .from(projectTags)
      .where(
        and(eq(projectTags.projectId, projectId), eq(projectTags.tagId, tagId))
      )
      .limit(1)
    if (existing.length > 0) continue
    await db.insert(projectTags).values({ projectId, tagId })
  }
}

async function ensureProjectMember(
  projectId: string,
  userId: string,
  leadRoleId: string
) {
  const existing = await db
    .select()
    .from(projectMembers)
    .where(eq(projectMembers.projectId, projectId))
    .limit(1)

  const found = existing[0]
  if (found) return found

  const [member] = await db
    .insert(projectMembers)
    .values({
      projectId,
      userId,
      roleId: leadRoleId,
      status: "active",
    })
    .returning()

  if (!member) throw new Error("Failed to create project member.")
  return member
}

export async function seedDemoWorkspace() {
  const owner = await pickUser()
  console.log(`• Seeding as ${owner.name} <${owner.email}>`)

  const { workspace, leadRoleId } = await resolveWorkspace(owner.id)
  const workspaceTagIds = await ensureWorkspaceTags(workspace.id)

  for (const seedProject of SEED_PROJECTS) {
    const existingProject = await db
      .select()
      .from(projects)
      .where(eq(projects.slug, seedProject.slug))
      .limit(1)

    let project = existingProject[0]
    if (!project) {
      const [created] = await db
        .insert(projects)
        .values({
          workspaceId: workspace.id,
          slug: seedProject.slug,
          title: seedProject.title,
          description: seedProject.description,
          status: seedProject.status,
          deadline:
            seedProject.deadlineInDays === null
              ? null
              : daysFromNow(seedProject.deadlineInDays),
          gradientStart: seedProject.gradient.start,
          gradientEnd: seedProject.gradient.end,
          createdBy: owner.id,
        })
        .returning()
      if (!created) throw new Error(`Failed to create ${seedProject.slug}.`)
      project = created
      console.log(`  – project "${project.title}"`)
    } else if (!project.gradientStart) {
      // Backfill only when no color is set. Checks gradientStart alone —
      // gradient_end is intentionally unused and always null.
      const [patched] = await db
        .update(projects)
        .set({
          gradientStart: seedProject.gradient.start,
          gradientEnd: seedProject.gradient.end,
        })
        .where(eq(projects.id, project.id))
        .returning()
      if (patched) {
        project = patched
        console.log(`  – gradient applied to "${project.title}"`)
      }
    }

    const member = await ensureProjectMember(project.id, owner.id, leadRoleId)
    await ensureProjectTags(project.id, seedProject.tagLabels, workspaceTagIds)

    for (const seedTask of seedProject.tasks) {
      const existingTask = await db
        .select({ id: tasks.id })
        .from(tasks)
        .where(eq(tasks.title, seedTask.title))
        .limit(1)

      let taskId = existingTask[0]?.id
      if (!taskId) {
        const [task] = await db
          .insert(tasks)
          .values({
            projectId: project.id,
            title: seedTask.title,
            description: null,
            status: seedTask.status,
            priority: seedTask.priority,
            dueDate:
              seedTask.dueInDays === null
                ? null
                : daysFromNow(seedTask.dueInDays),
            createdBy: owner.id,
          })
          .returning()
        if (!task) throw new Error(`Failed to create task ${seedTask.title}.`)
        taskId = task.id

        await db
          .insert(taskAssignees)
          .values({ taskId, projectMemberId: member.id })

        if (seedTask.transitionedTo) {
          await db.insert(statusHistory).values({
            taskId,
            fromStatus: "todo",
            toStatus: seedTask.transitionedTo,
            changedBy: owner.id,
            changedAt: daysFromNow(seedTask.dueInDays ?? -1),
          })
        }
        console.log(`    · task "${task.title}"`)
      }
    }
  }

  console.log("\nDone. Reload /w/demo-studio to see the overview and projects.")
}

const isDirectRun =
  typeof process !== "undefined" &&
  process.argv[1]?.replace(/\\/g, "/").endsWith("seed-demo.ts")

if (isDirectRun) {
  // Only fall back to a local .env when the variable isn't already in the
  // environment. loadEnvFile overwrites, which would clobber values injected
  // by `doppler run`.
  if (!process.env.DATABASE_URL_UNPOOLED) {
    try {
      process.loadEnvFile(".env")
    } catch {
      // No .env file; rely on the ambient environment.
    }
  }

  seedDemoWorkspace()
    .then(async () => {
      await pool.end()
      process.exit(0)
    })
    .catch(async (error) => {
      console.error(`\nSeed failed: ${(error as Error).message}`)
      await pool.end()
      process.exit(1)
    })
}
