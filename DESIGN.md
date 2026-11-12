# DESIGN.md — Antara

> Locked design direction. Read this before any UI work. Append to the decisions log; never rewrite history in it.

## The 0→1 action

**Done when a workspace admin can change a member's role, suspend or unsuspend them, remove them — and anyone can leave — with the roster, sidebar count and switcher showing the result without a reload.**

- Primary actions: the per-row `⋯` menu on `/w/:slug/team` → **Change role**, **Suspend / Unsuspend**, **Remove from workspace**; and on your own row → **Leave workspace**.
- Where the result goes: `team.role_id` (role change), `team.status = 'suspended' | 'active'` (suspend / unsuspend), `team.status = 'left'` (removal and leaving), `workspaces.owner_left_at` (an owner leaving) in Postgres, then `teamKeys.members(workspaceId)`, `workspaceKeys.teamCount(slug)` and `workspaceKeys.list` are invalidated.
- Current status: **wired** for role and removal (PR #38), suspension (#39), re-invite/dormancy (#40), and leaving in this slice.

Server-side acceptance (part of done, not a nice-to-have):

| Guard         | Behaviour                                                                                                                        |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Owner row     | No management menu rendered; server rejects any change targeting the workspace owner                                             |
| Self          | Management actions cannot target your own seat; **leaving** is the one self-action, and it is its own endpoint                   |
| Pending seat  | An unaccepted invite can only be revoked; it has no status to suspend                                                            |
| No-op         | Re-applying the current role, suspending a suspended member, or unsuspending an active one is recorded with a reason             |
| Last admin    | Server refuses a change that would leave nobody able to manage, including suspending the last admin and leaving as the last one  |
| Role validity | Role resolved through `resolveWorkspaceRole` (workspace scope only), never by raw id                                             |
| Suspension    | `status = 'suspended'`; `resolveMembership` only accepts `active`, so routes, server functions and project access all refuse     |
| Removal       | `status = 'left'`; every access path (`resolveMembership`, `work-access`, project joins) already filters it out                  |
| Leaving       | `status = 'left'` for the caller; an owner additionally gets `owner_left_at`, so their ownership is dormant, not deleted         |
| Visibility    | A suspended or left seat is hidden from the workspace switcher and the landing resolver, so nobody sees a workspace that bounces |

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

| Date       | Decision                                                                                            | Why                                                                                                                                                                                                                                                                                     | Supersedes                                                                                                                                                               |
| ---------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-11-11 | Assignable roles are the two seeded **workspace-scope** roles: `admin`, `member`                    | `resolveWorkspaceRole` already guarantees workspace scope; project-scope `lead`/`member` share titles and must not leak in. No migration.                                                                                                                                               | —                                                                                                                                                                        |
| 2026-11-11 | Removal sets `team.status = 'left'`, never deletes the row                                          | All access paths already filter it; authored versions, comments and approvals keep a real name instead of "a former member"                                                                                                                                                             | —                                                                                                                                                                        |
| 2026-11-11 | Admins may manage other admins; the owner is untouchable; refuse a change that drops the last admin | The zero-admin guard is the actual protection; owner-only admin management deadlocks a two-admin team when the owner is away                                                                                                                                                            | —                                                                                                                                                                        |
| 2026-11-11 | Role change applies immediately from a submenu; removal uses `AlertDialog`                          | Role change is reversible and low-stakes; removal ends someone's access and needs the name in the prompt                                                                                                                                                                                | —                                                                                                                                                                        |
| 2026-11-11 | Extract `requireWorkspaceManager` from `src/server/functions/invites.ts` and share it               | A second copy of the session + verified-email + admin gate is a second bug; the codebase's own doctrine (`access-service.ts`) forbids it                                                                                                                                                | —                                                                                                                                                                        |
| 2026-11-11 | The owner counts as a manager regardless of `ownerLeftAt`                                           | `resolveMembership` grants the owner admin from `owner_id` and ignores the flag, so counting them out refused removals the owner is entitled to make. The last-admin guard is therefore defence-in-depth, unreachable through today's API — proven by a runtime smoke, not assumed      | The first draft's "owner has left" reasoning, which the flag does not actually implement                                                                                 |
| 2026-11-12 | Suspension blocks access but keeps the session                                                      | `resolveMembership` already requires `status = 'active'`, so the status is the gate and every route/action refuses immediately. Killing sessions adds a re-login cost on unsuspend and buys nothing the status doesn't already enforce                                                  | —                                                                                                                                                                        |
| 2026-11-12 | Suspend and unsuspend ship together, toggled by the row                                             | A one-way door in the UI is worse than no door: an admin who suspends by mistake would need a DB edit. The menu item flips with `member.status`, and the roster already renders the "Suspended" pill                                                                                    | —                                                                                                                                                                        |
| 2026-11-12 | A suspended seat disappears from the workspace switcher and the landing resolver                    | Both listed on `status != 'left'`, so a suspended member saw a workspace they could not open and bounced on click. Filtering to `active` makes the switcher agree with `resolveMembership`                                                                                              | The earlier `ne(team.status, "left")` filter, which predated suspension                                                                                                  |
| 2026-11-12 | Re-inviting a removed member revives the existing seat                                              | A `left` seat keeps `joined_at`, so the invite gate called a former member a current one and blocked the one action an admin most needs after a mistake. Reviving the row keeps a single seat per person and preserves authorship; inserting would collide on `(workspace_id, user_id)` | `assertCanInvite`'s "joined_at is enough to block" rule, and insert-always in `createInvite`                                                                             |
| 2026-11-12 | `owner_left_at` is honoured in `resolveMembership`                                                  | The column promised dormant access and delivered none of it. Now a dormant owner gets no ownership-derived admin, falls back to their seat, and disappears from the switcher unless that seat is active. The last-manager count follows the same rule                                   | "The owner counts as a manager regardless of `ownerLeftAt`", which only held while the flag was inert; a dormant owner with an admin seat still counts, through the seat |
| 2026-11-12 | An owner leaves only if another admin exists, and ownership goes dormant rather than transferring   | A transfer flow needs its own guards and can strand a workspace halfway. Dormancy uses the flag that already exists: the admins keep running it, and the owner's access ends exactly as an ordinary member's would                                                                      | —                                                                                                                                                                        |
| 2026-11-12 | Everyone can leave from their own row; it is a self-endpoint, not a member action                   | Requiring admin rights to leave would make the owner an exception to their own exit and strand members in workspaces they want out of. Leaving never targets anyone else, so it needs only a verified session                                                                           | The blanket "no self-targeting" rule, which stays true for every _management_ action                                                                                     |
| 2026-11-12 | An invite to a suspended person says to unsuspend them                                              | "Already in this workspace" reads like a fact to accept; the admin's actual route is the unsuspend item on the same row, so the refusal names it                                                                                                                                        | The single generic already-member message                                                                                                                                |

## Do not change

- The owner pill (`bg-primary`) and the "owner" label — it is the only unambiguous rank cue on the row.
- Roster order, search field, and the pending-invite "Awaiting" badge.
- The invite flow (`InviteDialog`, `createInviteFn`) — this slice only reuses its gate.
- `listWorkspaceMembers`' `includeInviter` gating; do not start sending inviter names to non-managers.
- The Leave item lives on your own row only; it is never offered beside the management actions.

## Open questions

- **An owner who leaves cannot return as owner.** `owner_left_at` is never cleared and ownership never moves, so a returning owner comes back as an invited member at best. Decide whether that needs a reclaim path or an ownership transfer before anyone relies on it.
- **Stale admin UI after demotion.** `workspaceRole` is stamped by the route loader, so a demoted admin keeps admin affordances until navigation. Acceptable for now; revisit if admins are demoted mid-session in practice.

## This vertical slice

1. **Leaving** — `leaveWorkspace` in `member-service`, gated by `checkSelfLeave` (owner/last-admin refusals) and by a verified session rather than the admin gate. The owner path stamps `owner_left_at` and leaves the seat `left` with `joined_at` intact.
2. **Self row** — `WorkspaceMemberItem` now carries `userId`, the workspace layout passes the viewer's id, and the row with a matching id gets a Leave menu instead of the management menu. The dialog resolves the destination server-side after the write.
3. **Suspended invite** — `assertCanInvite` distinguishes a suspended seat and names the unsuspend route.
4. **Shared gate** — `requireVerifiedSession` moved next to `requireWorkspaceManager`, which now calls it; invites and leaving both use one definition.

## Next vertical slice

- **Owner reclaim or transfer.** Ownership never moves and `owner_left_at` is never cleared, so a departed owner cannot own again. Decide the shape before someone needs it.
- **Stale admin UI after demotion** — refresh the route context when the viewer's own role changes.
