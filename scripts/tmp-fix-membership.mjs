import { Pool } from "pg"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL_UNPOOLED,
  ssl: { rejectUnauthorized: false },
})

const r = await pool.query(
  `update team set joined_at = now(), last_opened_at = now()
   where user_id = (select id from "user" where email like 'smoke-inbox-%@antara.test')
   returning id, user_id, workspace_id, status, joined_at`
)
console.table(r.rows)
await pool.end()
