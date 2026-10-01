import type { db } from "./index"
import { roles } from "./schema/workspaces"

export const SYSTEM_ROLE_ADMIN = "admin"
export const SYSTEM_ROLE_MEMBER = "member"
export const SYSTEM_ROLE_LEAD = "lead"

/**
 * Seeds the default roles for a newly created workspace:
 * admin + member (workspace scope) and lead (project scope).
 * Permission checks key on `isSystem + scope`, never on title strings.
 */
export async function seedWorkspaceRoles(
  database: Pick<typeof db, "insert">,
  workspaceId: string
) {
  const [admin, member, lead] = await database
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
    ])
    .returning()

  return { admin, member, lead }
}
