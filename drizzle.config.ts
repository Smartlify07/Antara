import { defineConfig } from "drizzle-kit"

export default defineConfig({
  schema: [
    "./src/db/schema/auth.ts",
    "./src/db/schema/workspaces.ts",
    "./src/db/schema/projects.ts",
    "./src/db/schema/deliverables.ts",
    "./src/db/schema/tags.ts",
    "./src/db/schema/tasks.ts",
    "./src/db/schema/assets.ts",
    "./src/db/schema/approvals.ts",
    "./src/db/schema/comments.ts",
    "./src/db/schema/notifications.ts",

    "./src/db/schema/requests.ts",
    "./src/db/enums.ts",
  ],
  // Enums are declared in a separate file; keep it listed so drizzle-kit
  // emits CREATE TYPE instead of silently dropping them.
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED!,
  },
})
