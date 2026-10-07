import type { db } from "./index"
import { roles } from "./schema/workspaces"

export const SYSTEM_ROLE_ADMIN = "admin"
export const SYSTEM_ROLE_MEMBER = "member"
export const SYSTEM_ROLE_LEAD = "lead"

/**
 * Seeds the default roles for a newly created workspace.
 *
 * Project scope needs both `lead` and `member`: every project_members row
 * points at a project-scope role, so a workspace-scope `member` role alone
 * would leave project creation without a role to assign.
 *
 * Permission checks key on `isSystem + scope`, never on title strings.
 */
export async function seedWorkspaceRoles(
  database: Pick<typeof db, "insert">,
  workspaceId: string
) {
  const [admin, member, lead, projectMember] = await database
    .insert(roles)
    .values([
      {
        workspaceId,
        scope: "workspace",
        title: SYSTEM_ROLE_ADMIN,
        isSystem: true,
      },
      {
        workspaceId,
        scope: "workspace",
        title: SYSTEM_ROLE_MEMBER,
        isSystem: true,
      },
      {
        workspaceId,
        scope: "project",
        title: SYSTEM_ROLE_LEAD,
        isSystem: true,
      },
      {
        workspaceId,
        scope: "project",
        title: SYSTEM_ROLE_MEMBER,
        isSystem: true,
      },
    ])
    .returning()

  return { admin, member, lead, projectMember }
}
