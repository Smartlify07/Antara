import { relations } from "drizzle-orm"
import {
  account,
  approvals,
  assetVersions,
  assets,
  comments,
  deliverables,
  memberTags,
  projectMembers,
  projects,
  projectUpdates,
  pushSubscriptions,
  requests,
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
  requests: many(requests),
  deliverablesCreated: many(deliverables),
  approvals: many(approvals),
  pushSubscriptions: many(pushSubscriptions),
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
  requests: many(requests),
  deliverables: many(deliverables),
  approvals: many(approvals),
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
  updates: many(projectUpdates),
  deliverables: many(deliverables),
}))

export const requestsRelations = relations(requests, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [requests.workspaceId],
    references: [workspaces.id],
  }),
  requester: one(user, {
    fields: [requests.requesterId],
    references: [user.id],
  }),
  project: one(projects, {
    fields: [requests.projectId],
    references: [projects.id],
  }),
  deliverables: many(deliverables),
}))

export const deliverablesRelations = relations(
  deliverables,
  ({ one, many }) => ({
    workspace: one(workspaces, {
      fields: [deliverables.workspaceId],
      references: [workspaces.id],
    }),
    project: one(projects, {
      fields: [deliverables.projectId],
      references: [projects.id],
    }),
    request: one(requests, {
      fields: [deliverables.requestId],
      references: [requests.id],
    }),
    owner: one(team, { fields: [deliverables.ownerId], references: [team.id] }),
    creator: one(user, {
      fields: [deliverables.createdBy],
      references: [user.id],
    }),
    tasks: many(tasks),
    assets: many(assets),
  })
)

export const approvalsRelations = relations(approvals, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [approvals.workspaceId],
    references: [workspaces.id],
  }),
  version: one(assetVersions, {
    fields: [approvals.assetVersionId],
    references: [assetVersions.id],
  }),
  approver: one(user, {
    fields: [approvals.approverId],
    references: [user.id],
  }),
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
  deliverable: one(deliverables, {
    fields: [tasks.deliverableId],
    references: [deliverables.id],
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

export const commentsRelations = relations(comments, ({ one }) => ({
  author: one(user, { fields: [comments.authorId], references: [user.id] }),
  workspace: one(workspaces, {
    fields: [comments.workspaceId],
    references: [workspaces.id],
  }),
}))

export const projectUpdatesRelations = relations(
  projectUpdates,
  ({ one, many }) => ({
    project: one(projects, {
      fields: [projectUpdates.projectId],
      references: [projects.id],
    }),
    author: one(user, {
      fields: [projectUpdates.authorId],
      references: [user.id],
    }),
    versions: many(assetVersions),
  })
)

export const assetsRelations = relations(assets, ({ one, many }) => ({
  project: one(projects, {
    fields: [assets.projectId],
    references: [projects.id],
  }),
  task: one(tasks, { fields: [assets.taskId], references: [tasks.id] }),
  deliverable: one(deliverables, {
    fields: [assets.deliverableId],
    references: [deliverables.id],
  }),
  creator: one(user, { fields: [assets.createdBy], references: [user.id] }),
  versions: many(assetVersions),
}))

export const assetVersionsRelations = relations(assetVersions, ({ one }) => ({
  asset: one(assets, {
    fields: [assetVersions.assetId],
    references: [assets.id],
  }),
  update: one(projectUpdates, {
    fields: [assetVersions.updateId],
    references: [projectUpdates.id],
  }),
  uploader: one(user, {
    fields: [assetVersions.uploadedBy],
    references: [user.id],
  }),
}))

export const pushSubscriptionsRelations = relations(
  pushSubscriptions,
  ({ one }) => ({
    user: one(user, {
      fields: [pushSubscriptions.userId],
      references: [user.id],
    }),
  })
)
