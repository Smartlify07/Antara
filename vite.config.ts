import { defineConfig } from "vite"
import { configDefaults } from "vitest/config"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { nitro } from "nitro/vite"

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [devtools(), tailwindcss(), tanstackStart(), nitro(), viteReact()],
  // Worktree copies of this repo live under .worktrees/; vitest must not scan
  // them — their tests already run in their own checkouts, and cross-root
  // imports here produce duplicate-React "invalid hook call" failures that
  // have nothing to do with the code under test.
  test: {
    exclude: [...configDefaults.exclude, "**/.worktrees/**"],
  },
})

export default config
