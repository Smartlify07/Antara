# AGENTS.md — Antara

> How to work in this repo. Read before your first command.

## Environment: Doppler is the only source of truth

Secrets and connection strings live in **Doppler**, not in `.env` files. Do not
ask for a database URL, do not read one out of a `.env`, and never paste one into
a chat, a commit, or a log.

| Setting         | Value                                                                      |
| --------------- | -------------------------------------------------------------------------- |
| Doppler project | `antara`                                                                   |
| Default config  | `dev` (`dev_personal` for personal overrides, `stg`, `prd` for deployment) |
| CLI             | `doppler` v3+, already authenticated on the dev machine                    |

### Run anything that needs env through Doppler

```powershell
doppler run -p antara -c dev -- pnpm dev
doppler run -p antara -c dev -- pnpm db:migrate
doppler run -p antara -c dev -- pnpm db:seed:demo
doppler run -p antara -c dev -- node --import tsx scripts/<script>.ts
```

`doppler run -- <command>` injects every secret into that process only. Nothing
is written to disk, so there is no local file to fall out of date.

### Inspecting secrets without leaking them

```powershell
doppler secrets --only-names -p antara -c dev            # names only — safe to show
doppler secrets get DATABASE_URL_UNPOOLED -p antara -c dev --plain   # only when a tool genuinely needs it; never echo it
```

### Rules

- **Do not** create, copy, or commit a real `.env`. `.env.example` documents the
  variable _names_ and nothing else.
- **Do not** carry a `.env` between worktrees to "get the DB working". Wrap the
  command in `doppler run` instead.
- A local `.env` may exist and may hold **placeholder** values. It is not
  authoritative and a failure caused by it is not a bug in the app — re-run the
  command under `doppler run` before concluding anything.
- If a Doppler call fails with "config not found" or an auth error, say so and
  stop; do not substitute a guessed connection string.
- New required variables: add the **name** to `.env.example` and the value to
  Doppler (`doppler secrets set NAME -p antara -c dev`), never to git.

## Commands

| Task                   | Command                                                  |
| ---------------------- | -------------------------------------------------------- |
| Dev server (port 3000) | `doppler run -p antara -c dev -- pnpm dev`               |
| Typecheck              | `pnpm typecheck`                                         |
| Lint                   | `pnpm lint` (see note)                                   |
| Tests                  | `pnpm test`                                              |
| Production build       | `pnpm build` (also checks the client bundle for DB URLs) |
| Format                 | `pnpm format`                                            |

`pnpm lint` is currently red on a set of pre-existing files (`workspace-service`,
`project-service`, `request-service`, `invites`, `invite-dialog`). Check your own
work with `pnpm exec eslint <changed paths>` and compare against `HEAD` before
attributing an error to your change.

## Working agreements

- Worktrees live in `.worktrees/<slug>` and are gitignored. Install with
  `pnpm install` (the store is shared), then run commands via Doppler.
- One vertical slice at a time: wire the primary action, prove it with a real
  record, then style it.
- Server-side checks are the real ones. A hidden UI control is not
  authorization; every management action re-validates in a service.
