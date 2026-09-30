import { relations } from "drizzle-orm"
import {
  account,
  assets,
  comments,
  memberTags,
  projectMembers,
  projects,
  roles,
  session,
  statusHistory,
  tags,
  taskAssignees,
  tasks,
  team,
  user,
  verification,
  workspaceInvites,
  workspaces,
} from "./schema/index"

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  ownedWorkspaces: many(workspaces),
  teamMemberships: many(team),
  projectMemberships: many(projectMembers),
  createdProjects: many(projects),
  createdTasks: many(tasks),
  comments: many(comments),
  uploadedAssets: many(assets),
  sentInvites: many(workspaceInvites),
}))

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}))

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}))

export const verificationRelations = relations(verification, () => ({}))

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  owner: one(user, { fields: [workspaces.ownerId], references: [user.id] }),
  projects: many(projects),
  team: many(team),
  roles: many(roles),
  invites: many(workspaceInvites),
  tags: many(tags),
}))

export const rolesRelations = relations(roles, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [roles.workspaceId],
    references: [workspaces.id],
  }),
  teamMemberships: many(team),
  projectMemberships: many(projectMembers),
  invites: many(workspaceInvites),
}))

export const teamRelations = relations(team, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [team.workspaceId],
    references: [workspaces.id],
  }),
  user: one(user, { fields: [team.userId], references: [user.id] }),
  role: one(roles, { fields: [team.roleId], references: [roles.id] }),
}))

export const workspaceInvitesRelations = relations(
  workspaceInvites,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [workspaceInvites.workspaceId],
      references: [workspaces.id],
    }),
    role: one(roles, {
      fields: [workspaceInvites.roleId],
      references: [roles.id],
    }),
    inviter: one(user, {
      fields: [workspaceInvites.invitedBy],
      references: [user.id],
    }),
  })
)

export const projectsRelations = relations(projects, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [projects.workspaceId],
    references: [workspaces.id],
  }),
  creator: one(user, { fields: [projects.createdBy], references: [user.id] }),
  members: many(projectMembers),
  tasks: many(tasks),
  assets: many(assets),
}))

export const projectMembersRelations = relations(
  projectMembers,
  ({ one, many }) => ({
    project: one(projects, {
      fields: [projectMembers.projectId],
      references: [projects.id],
    }),
    user: one(user, {
      fields: [projectMembers.userId],
      references: [user.id],
    }),
    role: one(roles, {
      fields: [projectMembers.roleId],
      references: [roles.id],
    }),
    tags: many(memberTags),
    assignments: many(taskAssignees),
  })
)

export const tagsRelations = relations(tags, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [tags.workspaceId],
    references: [workspaces.id],
  }),
  members: many(memberTags),
}))

export const memberTagsRelations = relations(memberTags, ({ one }) => ({
  tag: one(tags, { fields: [memberTags.tagId], references: [tags.id] }),
  member: one(projectMembers, {
    fields: [memberTags.projectMemberId],
    references: [projectMembers.id],
  }),
}))

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
  creator: one(user, { fields: [tasks.createdBy], references: [user.id] }),
  assignees: many(taskAssignees),
  history: many(statusHistory),
  comments: many(comments),
  assets: many(assets),
}))

export const taskAssigneesRelations = relations(taskAssignees, ({ one }) => ({
  task: one(tasks, { fields: [taskAssignees.taskId], references: [tasks.id] }),
  member: one(projectMembers, {
    fields: [taskAssignees.projectMemberId],
    references: [projectMembers.id],
  }),
}))

export const statusHistoryRelations = relations(statusHistory, ({ one }) => ({
  task: one(tasks, {
    fields: [statusHistory.taskId],
    references: [tasks.id],
  }),
  changedByUser: one(user, {
    fields: [statusHistory.changedBy],
    references: [user.id],
  }),
}))

export const commentsRelations = relations(comments, ({ one, many }) => ({
  task: one(tasks, { fields: [comments.taskId], references: [tasks.id] }),
  author: one(user, { fields: [comments.userId], references: [user.id] }),
  assets: many(assets),
}))

export const assetsRelations = relations(assets, ({ one }) => ({
  project: one(projects, {
    fields: [assets.projectId],
    references: [projects.id],
  }),
  task: one(tasks, { fields: [assets.taskId], references: [tasks.id] }),
  comment: one(comments, {
    fields: [assets.commentId],
    references: [comments.id],
  }),
  uploader: one(user, { fields: [assets.uploadedBy], references: [user.id] }),
}))
