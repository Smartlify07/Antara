# Definition of Done — Antara

How any piece of work in this repo is accepted. Agents confirm this checklist with
the user at task start (question tool), restate it, then return an **evidence
table** against it. An item without proof is unmet, not passed.

## Project default gates

| # | Gate | Proof |
|---|---|---|
| 1 | Types clean | `pnpm typecheck` exit 0 |
| 2 | Lint clean | `pnpm lint` exit 0 (auto-fixable violations fixed, not suppressed) |
| 3 | Tests green | `pnpm test` exit 0; new logic that extracted from components gets unit tests |
| 4 | App actually runs | Dev server up in background (`/dev` procedure), affected routes respond |
| 5 | Behavior verified in a real browser | Playwright MCP: open affected routes, exercise the primary flow, screenshot, console clean — BOTH light and dark themes |
| 6 | Handoff updated (only for increments merged to main or parked mid-way) | `docs/handoff.md` reflects the new state |

`pnpm build` is required only when structural or configuration files changed
(vite config, deps, bundle-relevant code, new fonts/assets).

## Per-task protocol

1. **Assignment** — if the user did not state acceptance criteria, the agent asks
   (question tool): "What does done look like?" proposing a 3–6 item checklist
   including gates 1–3 plus the behavior check. User can adjust.
2. **Restate** — the checklist appears in the agent's first working reply.
3. **Work** — todos mirror the checklist. The same failed approach twice = stop
   and ask, never a silent third attempt.
4. **Report** — final message: table of item → evidence (exit codes, screenshots,
   console results), with any UNMET rows as explicit blockers. "Done" is claimed
   only with all rows evidenced.

## Lane / parallel agent rules

Each parallel lane (worktree or subagent) carries its own checklist; lanes
declare the files they own so they never overlap. A lane that ends without
evidence is not "finished" — the orchestrator re-queries it.

## Known regression hotspots (extra check when touched)

- Auth/session code → smoke the email verification resend + invite acceptance flows.
- Migration-relevant changes → confirm target env's `__drizzle_migrations` state first.
- Request cards/dialogs → both the card view and the full dialog, with `scroll-fade` behavior intact.
