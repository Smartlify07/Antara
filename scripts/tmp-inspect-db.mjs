import { Pool } from "pg"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL_UNPOOLED,
  ssl: { rejectUnauthorized: false },
})

const q = async (label, sql, params) => {
  try {
    const r = await pool.query(sql, params)
    console.log(`\n=== ${label} ===`)
    if (r.rows.length === 0) console.log("(none)")
    else console.table(r.rows)
    return r.rows
  } catch (e) {
    console.log(`\n=== ${label} === ERROR: ${e.message}`)
    return []
  }
}

await q("host/db", `select current_database() as db, current_user as usr, version() as v`)
await q(
  "counts",
  `select 'user' t, count(*) n from "user"
   union all select 'workspaces', count(*) from workspaces
   union all select 'team', count(*) from team
   union all select 'projects', count(*) from projects
   union all select 'deliverables', count(*) from deliverables
   union all select 'assets', count(*) from assets
   union all select 'asset_versions', count(*) from asset_versions
   union all select 'notifications', count(*) from notifications
   union all select 'session', count(*) from session`
)
await q("users", `select id, email, name, email_verified, created_at from "user" order by created_at limit 20`)
await q("workspaces", `select id, slug, title, owner_id, deleted_at from workspaces order by created_at limit 20`)
await q(
  "team (active, with user)",
  `select t.id, t.workspace_id, t.user_id, t.email, t.status, r.title role
   from team t join roles r on r.id = t.role_id
   where t.user_id is not null
   order by t.created_at limit 30`
)
await q("projects", `select id, workspace_id, slug, title, status from projects order by created_at limit 20`)
await q(
  "notifications",
  `select n.id, n.user_id, n.workspace_id, n.type, n.subject_type, n.subject_id,
          n.read_at, n.created_at, u.email
   from notifications n join "user" u on u.id = n.user_id
   order by n.created_at desc limit 25`
)
await q(
  "notifications per user",
  `select u.email, count(*) total, count(*) filter (where n.read_at is null) unread
   from notifications n join "user" u on u.id = n.user_id group by u.email order by total desc`
)
await q(
  "deliverables",
  `select d.id, d.project_id, d.title, d.status from deliverables d order by d.created_at limit 10`
)
await q(
  "asset_versions",
  `select av.id, av.asset_id, av.version_number, a.deliverable_id from asset_versions av
   join assets a on a.id = av.asset_id order by av.created_at desc limit 10`
)

await pool.end()
