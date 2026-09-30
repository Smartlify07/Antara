import { Pool } from "pg"
import { drizzle } from "drizzle-orm/node-postgres"
import * as relations from "./relations"
import * as schema from "./schema"

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Add it to your .env file.")
}

// Neon requires SSL. `sslmode=require` in the connection string is not
// enough for node-postgres, so force SSL here.
// https://neon.com/docs/connect/connect-nodejs
export const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 10,
})

export const db = drizzle(pool, { schema: { ...schema, ...relations } })
