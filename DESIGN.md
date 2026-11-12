# DESIGN.md — Antara

> Locked design direction. Read this before any UI work. Append to the decisions log; never rewrite history in it.

## The 0→1 action

**Done when a workspace admin can change a member's role, suspend or unsuspend them, and remove them, and the roster plus the sidebar count show the result without a reload.**

- Primary actions: the per-row `⋯` menu on `/w/:slug/team` → **Change role**, **Suspend / Unsuspend**, **Remove from workspace**.
- Where the result goes: `team.role_id` (role change), `team.status = 'suspended' | 'active'` (suspend / unsuspend) and `team.status = 'left'` (removal) in Postgres, then `teamKeys.members(workspaceId)` and `workspaceKeys.teamCount(slug)` are invalidated.
- Current status: **wired** for role and removal (PR #38), **wired for suspension** in this slice. Suspension reuses `resolveMembership`'s existing `status = 'active'` requirement, so access stops without touching sessions.

Server-side acceptance (part of done, not a nice-to-have):

| Guard         | Behaviour                                                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Owner row     | No actions rendered; server rejects any change targeting the workspace owner                                                    |
| Self          | Server rejects acting on your own seat (role, suspension, removal) — "leave workspace" is a separate, unbuilt feature           |
| Pending seat  | An unaccepted invite can only be revoked; it has no status to suspend                                                           |
| No-op         | Re-applying the current role, suspending a suspended member, or unsuspending an active one is recorded with a reason             |
| Last admin    | Server refuses a change that would leave nobody able to manage, including suspending the last admin                              |
| Role validity | Role resolved through `resolveWorkspaceRole` (workspace scope only), never by raw id                                            |
| Suspension    | `status = 'suspended'`; `resolveMembership` only accepts `active`, so routes, server functions and project access all refuse    |
| Removal       | `status = 'left'`; every access path (`resolveMembership`, `work-access`, project joins) already filters it out                  |
| Visibility    | A suspended seat is hidden from the workspace switcher and the landing resolver, so nobody sees a workspace that bounces on click |

## Contract

```
Product:      Project + asset workspace for creative production teams
Character:    quiet, precise, trustworthy
World:        monochrome paper and ink; one grotesque doing all the work
Lingual:      continue as-is (existing system; this slice introduces no new visual language)
Rich moment:  the role pill re-labels in place the instant the menu closes — no page spinner,
              no row reflow, the dropdown just collapses
Motion:       no new motion. Radix menu/dialog defaults (100ms in/out), View Transitions stay 180ms.
              Row changes settle by re-render only.
Avoid:        a confirm dialog for a reversible role change; toasts for failures (inline `role="alert"`
              is the house pattern); new accent colors; uppercase tracked labels; spinners on optimistic paths
```

## Locked values

| Token                            | Value                                                                                                                                         |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Sans / mono                      | Bricolage Grotesque Variable — `--font-sans`; no mono in this slice                                                                           |
| Page H1 / section / body / meta  | `text-2xl font-medium tracking-tighter` / `text-base font-medium tracking-tight` / `text-sm tracking-tight` / `text-xs text-muted-foreground` |
| Display tracking                 | `tracking-tighter` on the page title, `tracking-tight` on body                                                                                |
| Controls / inputs height         | `h-8` default button, `h-7` `size="icon-sm"` trigger, `Input` at shadcn default                                                               |
| Radius (control / card / dialog) | `--radius: 0.625rem`; pills are `rounded-full`, rows live in a `rounded-xl border` list                                                       |
| Container / gutters              | Inherited from the workspace shell; team page is `flex flex-col gap-6`, no new container                                                      |
| Section padding                  | Card owns it (`CardContent`); row padding `p-3`, list gap `gap-3`                                                                             |
| Accent                           | None. `--primary` (ink) only; destructive is `--destructive` via `variant="destructive"`                                                      |
| Canvas / surface                 | `--background` / `--card`, separated by `--border`                                                                                            |
| Motion                           | View transitions 180ms `cubic-bezier(0.4, 0, 0.2, 1)`; menus 100ms; nothing else                                                              |

## Reference

- Source: the app's own team screen `src/components/team/team-members.tsx`, its invite dialog, and the existing destructive confirm in `src/components/workspace/project-card.tsx:287–321`.
- What we are taking from it: row anatomy exactly as it is today (36px avatar → name/email stack → status pill → role pill → `⋯`), `AlertDialog` with a pending-state action for destructive confirm, invalidate **list + sidebar badge** together, inline `role="alert"` errors.
- What we are deliberately not taking: a settings-page/permissions-matrix treatment, a modal for role change, a toast system (the app has none).

## Decisions log

| Date       | Decision                                                                                            | Why                                                                                                                                                                                                                                                                                | Supersedes                                                                               |
| ---------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 2026-11-11 | Assignable roles are the two seeded **workspace-scope** roles: `admin`, `member`                    | `resolveWorkspaceRole` already guarantees workspace scope; project-scope `lead`/`member` share titles and must not leak in. No migration.                                                                                                                                          | —                                                                                        |
| 2026-11-11 | Removal sets `team.status = 'left'`, never deletes the row                                          | All access paths already filter it; authored versions, comments and approvals keep a real name instead of "a former member"                                                                                                                                                        | —                                                                                        |
| 2026-11-11 | Admins may manage other admins; the owner is untouchable; refuse a change that drops the last admin | The zero-admin guard is the actual protection; owner-only admin management deadlocks a two-admin team when the owner is away                                                                                                                                                       | —                                                                                        |
| 2026-11-11 | Role change applies immediately from a submenu; removal uses `AlertDialog`                          | Role change is reversible and low-stakes; removal ends someone's access and needs the name in the prompt                                                                                                                                                                           | —                                                                                        |
| 2026-11-11 | Extract `requireWorkspaceManager` from `src/server/functions/invites.ts` and share it               | A second copy of the session + verified-email + admin gate is a second bug; the codebase's own doctrine (`access-service.ts`) forbids it                                                                                                                                           | —                                                                                        |
| 2026-11-11 | The owner counts as a manager regardless of `ownerLeftAt`                                           | `resolveMembership` grants the owner admin from `owner_id` and ignores the flag, so counting them out refused removals the owner is entitled to make. The last-admin guard is therefore defence-in-depth, unreachable through today's API — proven by a runtime smoke, not assumed | The first draft's "owner has left" reasoning, which the flag does not actually implement |
| 2026-11-12 | Suspension blocks access but keeps the session                                                      | `resolveMembership` already requires `status = 'active'`, so the status is the gate and every route/action refuses immediately. Killing sessions adds a re-login cost on unsuspend and buys nothing the status doesn't already enforce                                       | —                                                                                        |
| 2026-11-12 | Suspend and unsuspend ship together, toggled by the row                                         | A one-way door in the UI is worse than no door: an admin who suspends by mistake would need a DB edit. The menu item flips with `member.status`, and the roster already renders the "Suspended" pill                                                                    | —                                                                                        |
| 2026-11-12 | A suspended seat disappears from the workspace switcher and the landing resolver                | Both listed on `status != 'left'`, so a suspended member saw a workspace they could not open and bounced on click. Filtering to `active` makes the switcher agree with `resolveMembership`                                                                               | The earlier `ne(team.status, "left")` filter, which predated suspension                                                                    |
| 2026-11-12 | Re-inviting a removed member revives the existing seat                                           | A `left` seat keeps `joined_at`, so the invite gate called a former member a current one and blocked the one action an admin most needs after a mistake. Reviving the row keeps a single seat per person and preserves authorship; inserting would collide on `(workspace_id, user_id)` | `assertCanInvite`'s "joined_at is enough to block" rule, and insert-always in `createInvite` |
| 2026-11-12 | `owner_left_at` is honoured in `resolveMembership`                                               | The column promised dormant access and delivered none of it. Now a dormant owner gets no ownership-derived admin, falls back to their seat, and disappears from the switcher unless that seat is active. The last-manager count follows the same rule                | "The owner counts as a manager regardless of `ownerLeftAt`", which only held while the flag was inert; a dormant owner with an admin seat still counts, through the seat |

## Do not change

- The owner pill (`bg-primary`) and the "owner" label — it is the only unambiguous rank cue on the row.
- Roster order, search field, and the pending-invite "Awaiting" badge.
- The invite flow (`InviteDialog`, `createInviteFn`) — this slice only reuses its gate.
- `listWorkspaceMembers`' `includeInviter` gating; do not start sending inviter names to non-managers.

## Open questions

- **Nothing sets `owner_left_at` yet.** The flag is now honoured end to end, but there is no "leave workspace" or ownership-transfer flow that writes it, so no user can reach the dormant state. Decide the product shape before building it: leaving probably needs an ownership transfer, not just a flag.
- **A suspended member cannot be re-invited, only unsuspended.** `assertCanInvite` blocks any seat with `joinedAt` that is not `left`, which is right — but the refusal reads "already in this workspace" when the actionable answer is "unsuspend them".
- **Stale admin UI after demotion.** `workspaceRole` is stamped by the route loader, so a demoted admin keeps admin affordances until navigation. Acceptable for now; revisit if admins are demoted mid-session in practice.

## This vertical slice

1. **Invite revival** — `assertCanInvite` stops treating a `left` seat as a member; `createInvite` revives that row (pending, role from the invite) instead of inserting a second seat, and clears `joined_at` so acceptance is still required.
2. **Owner dormancy** — `resolveMembership` requires `owner_left_at IS NULL` for the owner-derived admin; `listWorkspaces` stops listing owned workspaces for a dormant owner; `countRemainingManagers` only counts the owner when they have not left.
3. **Proof** — typecheck, tests, build, and a runtime pass over both flows against the dev database.

## Next vertical slice

- **"Leave workspace" for owners**, or an explicit decision that ownership never leaves. The flag exists and is honoured; no flow writes it.
- **Suspension-aware invite refusal** — say "unsuspend them" instead of "already in this workspace".
