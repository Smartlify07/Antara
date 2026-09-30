import { defineConfig } from "drizzle-kit"

export default defineConfig({
  schema: [
    "./src/db/schema/auth.ts",
    "./src/db/schema/workspaces.ts",
    "./src/db/schema/projects.ts",
    "./src/db/schema/tags.ts",
    "./src/db/schema/tasks.ts",
    "./src/db/schema/assets.ts",
    "./src/db/enums.ts",
  ],
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED!,
  },
})
