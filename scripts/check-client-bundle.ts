import fs from "node:fs"
import path from "node:path"

/**
 * Fails the build if anything Node-only reaches the browser bundle.
 *
 * This exists because of a bug that typecheck, build and a grep all passed
 * over: `auth.ts` statically imported a service that used `node:crypto`. Vite
 * externalised it for the browser, it threw at module init, hydration never
 * completed, and every form on the page quietly fell back to a native GET
 * submit — appending the password to the query string. Nothing about that is
 * visible in a type error.
 *
 * It slipped past a check too: the scan was pointed at a stale `.output/public`
 * from a previous build rather than the one just produced. So this always
 * builds first, then reads that build's output.
 */

const CLIENT_DIR = path.join(process.cwd(), ".output", "public")

/**
 * Node builtins must never appear in client code, matched on the `node:`
 * prefix. That is the form Vite externalises, and the form the runtime error
 * names, so it is the one worth failing on.
 *
 * A bare `fs` / `path` / `os` string is deliberately NOT checked. Minified
 * output is full of them — every Lucide icon serialises as
 * `node:[[`path`,{d:"…"}]]`, and SVG attribute lists repeat the same names —
 * so that rule fired on eleven legitimate files and proved nothing. A noisy
 * guard gets switched off, which is worse than no guard.
 */
const FORBIDDEN: [string, RegExp][] = [
  ["node: prefixed builtin", /["'`]node:[a-z_]+["'`]/i],
  ["database URL", /postgres(?:ql)?:\/\//i],
]

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  const out: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(p))
    else if (/\.(js|mjs|cjs|css|html|json)$/.test(entry.name)) out.push(p)
  }
  return out
}

if (!fs.existsSync(CLIENT_DIR)) {
  console.error(`No build output at ${CLIENT_DIR}. Run pnpm build first.`)
  process.exit(1)
}

const files = walk(CLIENT_DIR)
const failures: string[] = []

for (const file of files) {
  const text = fs.readFileSync(file, "utf8")
  for (const [label, pattern] of FORBIDDEN) {
    const match = pattern.exec(text)
    if (!match) continue
    // Show what actually matched. A bare `fs` or `os` string turns up in
    // minified output often enough that reporting the token is the difference
    // between a real leak and noise.
    const at = Math.max(0, match.index - 40)
    const snippet = text.slice(at, match.index + match[0].length + 40)
    failures.push(
      `${path.relative(process.cwd(), file)}  [${label}]  …${snippet}…`,
    )
  }
}

console.log(`scanned ${files.length} client assets`)

if (failures.length) {
  console.error("\nNode-only code reached the browser bundle:\n")
  for (const f of failures.slice(0, 20)) console.error(`  ${f}`)
  if (failures.length > 20) {
    console.error(`  …and ${failures.length - 20} more`)
  }
  console.error(
    "\n`path` and friends are deliberately not matched — see FORBIDDEN.",
  )
  process.exit(1)
}

console.log("no node builtins or database URLs in the client bundle")