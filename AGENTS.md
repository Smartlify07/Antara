# AGENTS.md — Antara

Instructions for every agent working in this repository. Browsers or tools that
discover project instructions read this file; update it whenever a rule here
becomes wrong. Where this file conflicts with `docs/handoff.md`, handoff is more
current — handoff is updated at the end of every increment, this file holds
stable conventions.

## Identity

- Web-based collaborative multimedia project management system (see `product-prd.md`).
- TanStack Start (React 19, TypeScript, Vite 8 + nitro beta) · Tailwind v4 ·
  shadcn primitives under `src/components/ui` (unified `radix-ui` dep) ·
  TanStack Router + Query · react-hook-form + zod + cva · Framer Motion ·
  Drizzle ORM 0.45 over `pg` (Neon) · better-auth 1.7.6 · Cloudinary (assets) ·
  Resend (email) · vitest for tests. Package manager: **pnpm 10** (bun is not usable here).

## Commands (from package.json — run these, do not improvise)

| Purpose | Command |
|---|---|
| Dev server (background) | `pnpm dev` → http://localhost:3000 |
| Types | `pnpm typecheck` (tsc --noEmit) |
| Lint | `pnpm lint` (eslint) |
| Tests | `pnpm test` (vitest run) |
| Build | `pnpm build` (vite build + bundle check) |
| DB schema | `pnpm db:generate` / `pnpm db:push` / `pnpm db:migrate` · `pnpm db:studio` |
| Demo data | `pnpm db:seed:demo` |
| Format | `pnpm format` |

## Architecture map

```
src/
  routes/          TanStack Router routes (pages + API routes)
  components/      app UI; primitives in ui/ come from shadcn — never hand-roll them
  db/              drizzle schema.ts + enums + relations + seeds; a migration dir sits alongside
  lib/             business modules: auth, per-entity *-schemas.ts, queries/, email,
                   cloudinary, invite-token, app-origin… logic belongs HERE, not in components
  hooks/           shared React hooks
  server/          server-only code
  email/           email templates
docs/              handoff.md = living state · dod.md = acceptance gates · plans per feature
product-prd.md     product scope; read before building features
```

## Hard rules

- **Do not hand-roll UI shadcn provides.** Add via `pnpm dlx shadcn@latest add <name>`; shared visual units are one component rendered in several places, not duplicated markup.
- **Components stay under 100 lines**; logic moves into `lib/`, `hooks/`, or schema modules (this pattern already exists across `src/lib/*-schemas.ts` and `src/lib/queries/`).
- **Migrations:** migration `0007` is applied to dev/Neon and INTENTIONALLY wrong; `0008` fixes it. Never edit an applied migration — add a new one. Environments missing `0008` throw `SCHEMA_MISMATCH`; check `__drizzle_migrations` before debugging auth errors.
- **better-auth mail verification:** read `docs/handoff.md` §4 before touching any verification code — the token is a JWT signed with `BETTER_AUTH_SECRET`, not a DB row; OTP input flows are impossible with it.
- **Secrets:** never commit or print `.env*`, keys, tokens. `.env.example` documents variables. Secrets got rotated in the past; do not reintroduce.
- **Unmerged state risk:** PR #9 (`fix/auth-enumeration-and-verification`) carried `0008`; when fresh environments break on auth, check main received that migration.
- Scope note: "clients/reviewers" as product concepts are OUT of scope (handoff §2); invite backfill is security-critical and only fires on *verified* sessions.

## Git & delivery

- Branches: `feat/`, `fix/`, `chore/`, `refactor/` kebab-case. Feature work happens in worktrees under `.worktrees/<feature>` (canonical checkout) or OpenCode's own worktree group — never commingle Work-In-Progress lanes on one branch.
- Conventional Commits. PRs into `main` with a short What/Why + plan-doc links. Do not merge manually inside a lane unless asked; merges to main come from the user (or `/push` with explicit merge wording).
- Chore commands available globally in every OpenCode session: `/branch <name>`, `/dev`, `/push`, `/verify`.

## Verification

Definition of done and the acceptance protocol live in `docs/dod.md`.
Fast summary of every lane's gate: `pnpm typecheck` → `pnpm lint` → `pnpm test` →
dev-server smoke on affected routes via Playwright MCP (light + dark), evidence
table reported to the user before "done". The verification email resend + invite
acceptance flows must be smoke-tested whenever auth/session code changes.
