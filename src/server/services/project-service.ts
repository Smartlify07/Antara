import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNull,
  or,
  sql,
} from "drizzle-orm"
import { db } from "@/db"
import {
  comments,
  projectMembers,
  projects,
  projectTags,
  roles,
  tags,
  tasks,
  team,
  user,
} from "@/db/schema/index"
import * as accessService from "@/server/services/access-service"
import { resolveTagColor, tagColorFor } from "@/lib/tag-colors"
import type { ProjectStatus } from "@/db/enums"

/**
 * Project domain logic. Pure DB operations only — no HTTP, no session.
 * Thin server functions in `src/server/functions` own auth and call in here.
 */

/**
 * Delegated to `access-service` — see the note there for why this check is not
 * reimplemented locally.
 */
export const requireWorkspaceAccess = accessService.requireWorkspaceAccess

export interface ProjectListItem {
  id: string
  title: string
  slug: string
  description: string | null
  status: ProjectStatus
  startDate: Date | null
  deadline: Date | null
  createdAt: Date
  gradientStart: string | null
  gradientEnd: string | null
  taskCount: number
  memberCount: number
  commentCount: number
  tags: ProjectTagOption[]
}

/** Live projects in a workspace, soonest deadline first. */
export async function listWorkspaceProjects(
  workspaceId: string
): Promise<ProjectListItem[]> {
  const rows = await db
    .select({
      id: projects.id,
      title: projects.title,
      slug: projects.slug,
      description: projects.description,
      status: projects.status,
      startDate: projects.startDate,
      deadline: projects.deadline,
      createdAt: projects.createdAt,
      gradientStart: projects.gradientStart,
      gradientEnd: projects.gradientEnd,
    })
    .from(projects)
    .where(
      and(eq(projects.workspaceId, workspaceId), isNull(projects.deletedAt))
    )
    .orderBy(asc(projects.deadline), desc(projects.createdAt))

  if (rows.length === 0) return []

  const projectIds = rows.map((row) => row.id)

  const [taskCounts, memberCounts, commentCounts, tagRows] = await Promise.all([
    db
      .select({ projectId: tasks.projectId, total: count(tasks.id) })
      .from(tasks)
      .where(inArray(tasks.projectId, projectIds))
      .groupBy(tasks.projectId),
    db
      .select({
        projectId: projectMembers.projectId,
        total: count(projectMembers.id),
      })
      .from(projectMembers)
      .where(inArray(projectMembers.projectId, projectIds))
      .groupBy(projectMembers.projectId),
    // Comments hang off tasks, so roll them up through the task.
    db
      .select({ projectId: tasks.projectId, total: count(comments.id) })
      .from(tasks)
      .innerJoin(comments, eq(comments.taskId, tasks.id))
      .where(inArray(tasks.projectId, projectIds))
      .groupBy(tasks.projectId),
    db
      .select({
        projectId: projectTags.projectId,
        id: tags.id,
        label: tags.label,
        color: tags.color,
      })
      .from(projectTags)
      .innerJoin(tags, eq(projectTags.tagId, tags.id))
      .where(inArray(projectTags.projectId, projectIds))
      .orderBy(tags.label),
  ])

  const taskByProject = new Map(
    taskCounts.map((row) => [row.projectId, row.total])
  )
  const memberByProject = new Map(
    memberCounts.map((row) => [row.projectId, row.total])
  )
  const commentByProject = new Map(
    commentCounts.map((row) => [row.projectId, row.total])
  )
  const tagsByProject = new Map<string, ProjectTagOption[]>()
  for (const row of tagRows) {
    const list = tagsByProject.get(row.projectId) ?? []
    list.push({
      id: row.id,
      label: row.label,
      color: resolveTagColor(row.color, row.label),
    })
    tagsByProject.set(row.projectId, list)
  }

  return rows.map((row) => ({
    ...row,
    taskCount: taskByProject.get(row.id) ?? 0,
    memberCount: memberByProject.get(row.id) ?? 0,
    commentCount: commentByProject.get(row.id) ?? 0,
    tags: tagsByProject.get(row.id) ?? [],
  }))
}

/** True when no live project in this workspace already uses the slug. */
export async function isSlugAvailableInWorkspace(
  workspaceId: string,
  slug: string
): Promise<boolean> {
  const rows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(
        eq(projects.workspaceId, workspaceId),
        eq(projects.slug, slug),
        isNull(projects.deletedAt)
      )
    )
    .limit(1)

  return rows.length === 0
}

async function getProjectActionContext(
  workspaceId: string,
  userId: string
): Promise<{ role: string; isOwner: boolean }> {
  const membership = await accessService.resolveMembership(workspaceId, userId)
  if (!membership) {
    throw new Error("Workspace not found or you do not have access.")
  }
  return membership
}

export interface AssignableMember {
  /** Membership row id in `team` — what project_members can reference. */
  teamId: string
  name: string | null
  email: string | null
  image: string | null
  /** False for invited members who have not signed up yet. */
  joined: boolean
}

/**
 * Throws unless the actor may change project attributes. Admin/owner only —
 * mirrors `setProjectStatus`, which is the existing precedent for writes.
 */
async function requireProjectAdmin(
  workspaceId: string,
  userId: string,
  what: string
): Promise<void> {
  const access = await getProjectActionContext(workspaceId, userId)
  if (!access.isOwner && access.role !== "admin") {
    throw new Error(`Only workspace admins can ${what}.`)
  }
}

/**
 * Loads a live project by slug within a workspace, scoped so a slug from
 * another workspace resolves to null rather than leaking the row.
 */
export async function getProjectBySlug(
  workspaceId: string,
  slug: string
): Promise<ProjectListItem | null> {
  const [row] = await db
    .select({
      id: projects.id,
      title: projects.title,
      slug: projects.slug,
      description: projects.description,
      status: projects.status,
      startDate: projects.startDate,
      deadline: projects.deadline,
      createdAt: projects.createdAt,
      gradientStart: projects.gradientStart,
      gradientEnd: projects.gradientEnd,
    })
    .from(projects)
    .where(
      and(
        eq(projects.workspaceId, workspaceId),
        eq(projects.slug, slug),
        isNull(projects.deletedAt)
      )
    )
    .limit(1)

  if (!row) return null

  const [taskCount, memberCount, tagRows] = await Promise.all([
    db
      .select({ total: count(tasks.id) })
      .from(tasks)
      .where(eq(tasks.projectId, row.id)),
    db
      .select({ total: count(projectMembers.id) })
      .from(projectMembers)
      .where(eq(projectMembers.projectId, row.id)),
    db
      .select({
        id: tags.id,
        label: tags.label,
        color: tags.color,
      })
      .from(projectTags)
      .innerJoin(tags, eq(projectTags.tagId, tags.id))
      .where(eq(projectTags.projectId, row.id))
      .orderBy(tags.label),
  ])

  return {
    ...row,
    taskCount: taskCount[0]?.total ?? 0,
    memberCount: memberCount[0]?.total ?? 0,
    // Comments live on tasks; the detail page counts them from its own feed
    // rather than this rollup, so the card and the page agree by construction.
    commentCount: 0,
    tags: tagRows.map((tag) => ({
      id: tag.id,
      label: tag.label,
      color: resolveTagColor(tag.color, tag.label),
    })),
  }
}

/**
 * The project's existing memberships, resolved back to `team` rows.
 *
 * `project_members` stores `userId`/`email` and has no foreign key to `team`
 * at all — the link is by convention, made at insert time in `createProject`.
 * To drive the member chips we need `team.id`, so each membership is matched
 * back by user id where it has one, and by lowercased email where it does not
 * (an invited member who has not registered yet). Rows with neither a
 * `team` match nor an account are returned with a null `teamId` and are
 * filtered out by callers that need one.
 */
export async function listProjectMembers(
  workspaceId: string,
  projectId: string
): Promise<ProjectMemberRef[]> {
  const rows = await db
    .select({
      teamId: team.id,
      teamUserId: team.userId,
      teamEmail: team.email,
      joinedAt: team.joinedAt,
      name: user.name,
      userEmail: user.email,
      image: user.image,
      roleTitle: roles.title,
    })
    .from(projectMembers)
    .innerJoin(roles, eq(projectMembers.roleId, roles.id))
    .leftJoin(
      team,
      and(
        eq(team.workspaceId, workspaceId),
        eq(team.status, "active"),
        or(
          eq(team.userId, projectMembers.userId),
          sql`lower(${team.email}) = lower(${projectMembers.email})`
        )
      )
    )
    .leftJoin(user, eq(team.userId, user.id))
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.status, "active")
      )
    )
    .orderBy(asc(roles.title))

  return rows.map((row) => ({
    teamId: row.teamId,
    name: row.name,
    email: row.userEmail ?? row.teamEmail,
    image: row.image,
    joined: Boolean(row.teamUserId) && Boolean(row.joinedAt),
    isLead: row.roleTitle === "lead",
  }))
}

/** Workspace members available to add to a project, including invited
 * people who have not created an account yet.
 */
export async function listAssignableMembers(
  workspaceId: string
): Promise<AssignableMember[]> {
  const rows = await db
    .select({
      teamId: team.id,
      userId: team.userId,
      email: team.email,
      joinedAt: team.joinedAt,
      name: user.name,
      memberEmail: user.email,
      image: user.image,
    })
    .from(team)
    .leftJoin(user, eq(team.userId, user.id))
    .where(and(eq(team.workspaceId, workspaceId), eq(team.status, "active")))
    .orderBy(user.name)

  return rows.map((row) => ({
    teamId: row.teamId,
    name: row.name,
    email: row.memberEmail ?? row.email,
    image: row.image,
    joined: Boolean(row.userId) && Boolean(row.joinedAt),
  }))
}

/**
 * A current project membership, resolved to a workspace `team` row so it can
 * drive the member chips directly.
 */
export interface ProjectMemberRef {
  /** `team.id`, or null when the membership no longer maps to a workspace row. */
  teamId: string | null
  name: string | null
  email: string | null
  image: string | null
  joined: boolean
  isLead: boolean
}

export interface ProjectTagOption {
  id: string
  label: string
  color: string
}

/** Workspace tag vocabulary, for the tag chip. */
export async function listWorkspaceTags(
  workspaceId: string
): Promise<ProjectTagOption[]> {
  const rows = await db
    .select({ id: tags.id, label: tags.label, color: tags.color })
    .from(tags)
    .where(eq(tags.workspaceId, workspaceId))
    .orderBy(tags.label)

  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    color: resolveTagColor(row.color, row.label),
  }))
}

/** Resolves a workspace tag by label, case-insensitively. */
async function findTagByLabel(workspaceId: string, label: string) {
  const rows = await db
    .select()
    .from(tags)
    .where(eq(tags.workspaceId, workspaceId))
    .limit(200)

  const target = label.trim().toLowerCase()
  return rows.find((row) => row.label.trim().toLowerCase() === target) ?? null
}

/**
 * The subset of the drizzle client these helpers need. Both `db` and a
 * transaction handle satisfy it, so a helper works inside or outside a tx
 * without taking a union type at every call site.
 */
type DbLike = Pick<typeof db, "select" | "insert" | "update" | "delete">

/**
 * Looks up a project-scope role for the workspace, creating it if the
 * workspace predates it. Seeded per workspace by `db/seed.ts`, but backfilled
 * here so an older workspace never fails a write for a missing role.
 */
async function ensureProjectRole(
  tx: DbLike,
  workspaceId: string,
  title: "lead" | "member"
) {
  const [existing] = await tx
    .select()
    .from(roles)
    .where(
      and(
        eq(roles.workspaceId, workspaceId),
        eq(roles.scope, "project"),
        eq(roles.title, title)
      )
    )
    .limit(1)
  if (existing) return existing

  const [created] = await tx
    .insert(roles)
    .values({ workspaceId, scope: "project", title, isSystem: true })
    .returning()
  if (!created) throw new Error("Could not create the project role.")
  return created
}

export interface CreateProjectInput {
  title: string
  description?: string | null
  status: ProjectStatus
  startDate?: Date | null
  deadline?: Date | null
  memberTeamIds: string[]
  leadTeamId: string | null
  tagIds: string[]
  newTagLabels: string[]
  ownerUserId: string
}

export async function createProject(
  workspaceId: string,
  slug: string,
  input: CreateProjectInput
) {
  return db.transaction(async (tx) => {
    const [project] = await tx
      .insert(projects)
      .values({
        workspaceId,
        slug,
        title: input.title,
        description: input.description || null,
        status: input.status,
        startDate: input.startDate ?? null,
        deadline: input.deadline ?? null,
        createdBy: input.ownerUserId,
      })
      .returning()

    if (!project) throw new Error("Failed to create project.")

    const leadRole = await ensureProjectRole(tx, workspaceId, "lead")
    const memberRole = await ensureProjectRole(tx, workspaceId, "member")

    // Resolve the workspace user behind each picked team row so the
    // project membership links to a real user where one exists.
    const teamIds = [...new Set(input.memberTeamIds)]
    if (input.leadTeamId && !teamIds.includes(input.leadTeamId)) {
      teamIds.push(input.leadTeamId)
    }
    if (input.ownerUserId) {
      const [ownerRow] = await tx
        .select({ id: team.id })
        .from(team)
        .where(
          and(
            eq(team.workspaceId, workspaceId),
            eq(team.userId, input.ownerUserId),
            eq(team.status, "active")
          )
        )
        .limit(1)
      if (ownerRow && !teamIds.includes(ownerRow.id)) {
        teamIds.push(ownerRow.id)
      }
    }

    if (teamIds.length > 0) {
      const sourceRows = await tx
        .select({ id: team.id, userId: team.userId, email: team.email })
        .from(team)
        .where(
          and(
            eq(team.workspaceId, workspaceId),
            eq(team.status, "active"),
            inArray(team.id, teamIds)
          )
        )

      const values = sourceRows.map((row) => {
        const isLead = row.id === input.leadTeamId
        return {
          projectId: project.id,
          userId: row.userId,
          email: row.userId ? null : row.email,
          roleId: isLead ? leadRole.id : memberRole.id,
          status: "active" as const,
          addedBy: input.ownerUserId,
        }
      })

      if (values.length > 0) {
        await tx.insert(projectMembers).values(values)
      }
    }

    // Tags: reuse by id, create any new labels in the workspace vocabulary.
    const tagIds = new Set(input.tagIds)
    for (const label of input.newTagLabels) {
      const existing = await findTagByLabel(workspaceId, label)
      if (existing) {
        tagIds.add(existing.id)
        continue
      }
      const [created] = await tx
        .insert(tags)
        .values({ workspaceId, label: label.trim(), color: tagColorFor(label) })
        .onConflictDoNothing()
        .returning()
      if (created) tagIds.add(created.id)
    }

    if (tagIds.size > 0) {
      const validTags = await tx
        .select({ id: tags.id })
        .from(tags)
        .where(
          and(eq(tags.workspaceId, workspaceId), inArray(tags.id, [...tagIds]))
        )
      await tx
        .insert(projectTags)
        .values(
          validTags.map((tag) => ({ projectId: project.id, tagId: tag.id }))
        )
        .onConflictDoNothing()
    }

    return project
  })
}

/**
 * Everything the details page renders in one payload.
 *
 * `members` comes from `listProjectMembers` rather than the list query's
 * aggregate count, because the member chips need per-person rows.
 */
export interface ProjectDetail extends ProjectListItem {
  members: ProjectMemberRef[]
}

/** Loads a live project by id, scoped to the workspace. */
async function requireProject(
  workspaceId: string,
  projectId: string
): Promise<{ id: string }> {
  const [row] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(
        eq(projects.id, projectId),
        eq(projects.workspaceId, workspaceId),
        isNull(projects.deletedAt)
      )
    )
    .limit(1)

  if (!row) throw new Error("Project not found.")
  return row
}

export async function setProjectStatus(
  workspaceId: string,
  userId: string,
  projectId: string,
  status: ProjectStatus
): Promise<void> {
  const access = await getProjectActionContext(workspaceId, userId)
  if (!access.isOwner && access.role !== "admin") {
    throw new Error("Only workspace admins can change project status.")
  }

  const updated = await db
    .update(projects)
    .set({ status, updatedAt: new Date() })
    .where(
      and(
        eq(projects.id, projectId),
        eq(projects.workspaceId, workspaceId),
        isNull(projects.deletedAt)
      )
    )
    .returning({ id: projects.id })

  if (updated.length === 0) throw new Error("Project not found.")
}

export async function setProjectDates(
  workspaceId: string,
  userId: string,
  projectId: string,
  startDate: Date | null,
  deadline: Date | null
): Promise<void> {
  await requireProjectAdmin(workspaceId, userId, "change project dates")
  await requireProject(workspaceId, projectId)

  // The create form rejects an end before the start; repeat it here so the
  // dates chip cannot write a range the form would have refused.
  if (startDate && deadline && deadline < startDate) {
    throw new Error("End date must be on or after the start date.")
  }

  await db
    .update(projects)
    .set({ startDate, deadline, updatedAt: new Date() })
    .where(
      and(eq(projects.id, projectId), eq(projects.workspaceId, workspaceId))
    )
}

/**
 * Renames a project.
 *
 * The slug is deliberately left alone: project slugs are unique per workspace
 * and immutable (`projects.ts:41`), and are what the details route and every
 * card link are built from. Re-slugging would break bookmarks and any link
 * already shared, so the title and the URL can diverge.
 */
export async function setProjectTitle(
  workspaceId: string,
  userId: string,
  projectId: string,
  title: string
): Promise<void> {
  await requireProjectAdmin(workspaceId, userId, "rename the project")
  await requireProject(workspaceId, projectId)

  await db
    .update(projects)
    .set({ title, updatedAt: new Date() })
    .where(
      and(eq(projects.id, projectId), eq(projects.workspaceId, workspaceId))
    )
}

export async function setProjectDescription(
  workspaceId: string,
  userId: string,
  projectId: string,
  description: string | null
): Promise<void> {
  await requireProjectAdmin(workspaceId, userId, "edit the description")
  await requireProject(workspaceId, projectId)

  await db
    .update(projects)
    .set({ description: description || null, updatedAt: new Date() })
    .where(
      and(eq(projects.id, projectId), eq(projects.workspaceId, workspaceId))
    )
}

/**
 * Replaces the project's tag set. New labels are created in the workspace
 * vocabulary, exactly as `createProject` does, so the tag chip's inline
 * creation behaves the same on both screens.
 */
export async function setProjectTags(
  workspaceId: string,
  userId: string,
  projectId: string,
  tagIds: string[],
  newTagLabels: string[]
): Promise<void> {
  await requireProjectAdmin(workspaceId, userId, "change project tags")
  await requireProject(workspaceId, projectId)

  const ids = new Set(tagIds)
  for (const label of newTagLabels) {
    const existing = await findTagByLabel(workspaceId, label)
    if (existing) {
      ids.add(existing.id)
      continue
    }
    const [created] = await db
      .insert(tags)
      .values({
        workspaceId,
        label: label.trim(),
        color: tagColorFor(label),
      })
      .onConflictDoNothing()
      .returning()
    if (created) ids.add(created.id)
  }

  await db.transaction(async (tx) => {
    await tx.delete(projectTags).where(eq(projectTags.projectId, projectId))

    if (ids.size === 0) return

    // Only tags from this workspace may be attached; a caller cannot reach
    // another workspace's vocabulary by posting an id it guessed.
    const valid = await tx
      .select({ id: tags.id })
      .from(tags)
      .where(and(eq(tags.workspaceId, workspaceId), inArray(tags.id, [...ids])))

    if (valid.length === 0) return
    await tx
      .insert(projectTags)
      .values(valid.map((tag) => ({ projectId, tagId: tag.id })))
      .onConflictDoNothing()
  })
}

/**
 * Adds workspace members to an existing project.
 *
 * `createProject` was the only writer of `project_members`, so this is the
 * first path that adds someone after the fact. `onConflictDoNothing` relies on
 * the partial unique indexes on (projectId, userId) and (projectId, email) —
 * without them, re-adding someone would raise 23505 and surface as a failed
 * request rather than a no-op.
 */
export async function addProjectMembers(
  workspaceId: string,
  userId: string,
  projectId: string,
  teamIds: string[]
): Promise<void> {
  await requireProjectAdmin(workspaceId, userId, "add project members")
  await requireProject(workspaceId, projectId)

  const unique = [...new Set(teamIds)]
  if (unique.length === 0) return

  const memberRole = await ensureProjectRole(db, workspaceId, "member")

  const sourceRows = await db
    .select({ id: team.id, userId: team.userId, email: team.email })
    .from(team)
    .where(
      and(
        eq(team.workspaceId, workspaceId),
        eq(team.status, "active"),
        inArray(team.id, unique)
      )
    )

  if (sourceRows.length === 0) return

  const values = sourceRows.map((row) => ({
    projectId,
    userId: row.userId,
    email: row.userId ? null : row.email,
    roleId: memberRole.id,
    status: "active" as const,
    addedBy: userId,
  }))

  await db.insert(projectMembers).values(values).onConflictDoNothing()
}

/**
 * Moves the project `lead` role to a different member, or clears it.
 *
 * The lead is stored as a membership row with the project-scope `lead` role,
 * not as a pointer on the project, so this demotes the previous lead to a
 * plain member rather than deleting the row — removing it would drop the
 * person's project access, which is not what "change the lead" means.
 */
export async function setProjectLead(
  workspaceId: string,
  userId: string,
  projectId: string,
  teamId: string | null
): Promise<void> {
  await requireProjectAdmin(workspaceId, userId, "change the project lead")
  await requireProject(workspaceId, projectId)

  const [leadRole, memberRole] = await Promise.all([
    ensureProjectRole(db, workspaceId, "lead"),
    ensureProjectRole(db, workspaceId, "member"),
  ])

  const existing = await db
    .select({
      id: projectMembers.id,
      userId: projectMembers.userId,
      email: projectMembers.email,
      roleId: roles.title,
    })
    .from(projectMembers)
    .innerJoin(roles, eq(projectMembers.roleId, roles.id))
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.status, "active")
      )
    )

  const currentLead = existing.find((row) => row.roleId === "lead")

  await db.transaction(async (tx) => {
    if (currentLead) {
      await tx
        .update(projectMembers)
        .set({ roleId: memberRole.id, updatedAt: new Date() })
        .where(eq(projectMembers.id, currentLead.id))
    }

    if (!teamId) return

    // Match the incoming `team` row to an existing membership the same way
    // `listProjectMembers` matches them back, so reassigning the lead to
    // someone who is already a member promotes them instead of inserting a
    // duplicate row that the partial unique index would reject.
    const [target] = await tx
      .select({ id: team.id, userId: team.userId, email: team.email })
      .from(team)
      .where(
        and(
          eq(team.workspaceId, workspaceId),
          eq(team.status, "active"),
          eq(team.id, teamId)
        )
      )
      .limit(1)

    if (!target) throw new Error("That person is not a workspace member.")

    const membership = existing.find(
      (row) =>
        (target.userId && row.userId === target.userId) ||
        (target.email &&
          row.email &&
          row.email.toLowerCase() === target.email.toLowerCase())
    )

    if (membership) {
      await tx
        .update(projectMembers)
        .set({ roleId: leadRole.id, updatedAt: new Date() })
        .where(eq(projectMembers.id, membership.id))
      return
    }

    await tx.insert(projectMembers).values({
      projectId,
      userId: target.userId,
      email: target.userId ? null : target.email,
      roleId: leadRole.id,
      status: "active" as const,
      addedBy: userId,
    })
  })
}

export async function trashProject(
  workspaceId: string,
  userId: string,
  projectId: string
): Promise<void> {
  const access = await getProjectActionContext(workspaceId, userId)
  if (!access.isOwner && access.role !== "admin") {
    throw new Error("Only workspace admins can delete projects.")
  }

  const updated = await db
    .update(projects)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(projects.id, projectId),
        eq(projects.workspaceId, workspaceId),
        isNull(projects.deletedAt)
      )
    )
    .returning({ id: projects.id })

  if (updated.length === 0) throw new Error("Project not found.")
}
