import { Pool } from "pg"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL_UNPOOLED,
  ssl: { rejectUnauthorized: false },
})

const WORKSPACE_ID = "da0361d8-6cbe-4d1e-96f6-ae8b846ea384" // jee-ho-va
const SOURCE_USER = "GqbTnBzdjymNmPQyrkA0BoiN3oHw6mBg" // obinna.anosike.dev@gmail.com
const EMAIL = `smoke-inbox-${Date.now()}@antara.test`
const PASSWORD = "SmokePass123!"
const NAME = "Inbox Smoke"

const roles = await pool.query(
  `select id, scope, title from roles where workspace_id = $1`,
  [WORKSPACE_ID]
)
console.table(roles.rows)
const admin = roles.rows.find((r) => r.title.toLowerCase() === "admin")
if (!admin) throw new Error("no admin role")

// 1. Real sign-up through the running dev server, so the account is created by
// the app's own auth path (same as a human).
const res = await fetch("http://localhost:3000/api/auth/sign-up/email", {
  method: "POST",
  headers: { "content-type": "application/json", origin: "http://localhost:3000" },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD, name: NAME }),
})
console.log("signup status:", res.status)
console.log("signup body:", (await res.text()).slice(0, 300))

const user = await pool.query(`select id, email, email_verified from "user" where email = $1`, [EMAIL])
if (user.rows.length === 0) throw new Error("user not created")
const userId = user.rows[0].id
console.log("created user:", userId, EMAIL)

// 2. Verification normally happens by email; mark verified directly so the
// smoke run does not depend on the mailbox.
await pool.query(`update "user" set email_verified = true where id = $1`, [userId])

// 3. Seat in the workspace that already holds real projects/tasks/deliverables.
await pool.query(
  `insert into team (id, workspace_id, user_id, role_id, status)
   values (gen_random_uuid(), $1, $2, $3, 'active')`,
  [WORKSPACE_ID, userId, admin.id]
)

// 4. Copy real subjects from an existing user's notifications and re-target them
// at the smoke user: 25 rows => forces page 2 at INBOX_PAGE_SIZE = 20.
const subjects = await pool.query(
  `select type, subject_type, subject_id, actor_id
   from notifications where user_id = $1 order by created_at desc`,
  [SOURCE_USER]
)
console.log("source subjects:", subjects.rows.length)
if (subjects.rows.length === 0) throw new Error("no source notifications to model")

const rows = []
for (let i = 0; i < 25; i++) {
  const s = subjects.rows[i % subjects.rows.length]
  rows.push({
    type: s.type,
    subjectType: s.subject_type,
    subjectId: s.subject_id,
    actorId: s.actor_id,
    // Newest first; leave the newest 7 unread so the badge has a number.
    readAt: i < 7 ? null : new Date(Date.now() - (i + 1) * 60000).toISOString(),
    createdAt: new Date(Date.now() - i * 60000).toISOString(),
  })
}

for (const r of rows) {
  await pool.query(
    `insert into notifications (id, workspace_id, user_id, type, subject_type, subject_id, actor_id, read_at, created_at)
     values (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8)`,
    [WORKSPACE_ID, userId, r.type, r.subjectType, r.subjectId, r.actorId, r.readAt, r.createdAt]
  )
}

const check = await pool.query(
  `select count(*)::int total, count(*) filter (where read_at is null)::int unread from notifications where user_id = $1`,
  [userId]
)
console.table(check.rows)
console.log(JSON.stringify({ userId, email: EMAIL, password: PASSWORD, workspace: "jee-ho-va" }))

await pool.end()
