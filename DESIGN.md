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

---

# Daylight Native — landing and auth

> The daylight pass (2026-11-17/19) supersedes the visual tokens above — Inter,
> Instrument Serif and Fragment Mono replace the single grotesque. The team-slice
> acceptance rules and guards above remain in force.

The visual system is **Daylight Native** (see the comment at the top of
`src/styles.css`): Inter is the fact, Instrument Serif italic is the feeling,
Fragment Mono is the metadata. Light, paper-white, one blue accent
(`#0080ff`), ink `#0a0a0a`.

This file records decisions that are not obvious from the code, so the next
session doesn't re-litigate them.

---

## Landing hero — "notch + full-bleed screen"

Decided 2026-11-17. Replaces the previous full-width black header + two-column
hero + studio card. Revised the same day from an inset panel to a full-bleed
screen with a viewport-pinned notch.

### The shape

The hero is a **display**: a full-bleed screen with the notch cut into its top
edge — and the notch stays cut into the top edge of the page for the whole
scroll, not just while the hero is in view.

| Value | Choice |
|---|---|
| Screen | full bleed, edge to edge, `min-h-svh`, no inset frame |
| Content column | `max-w-7xl px-6` — the same gutters as every section below |
| Notch ink | `#0a0a0a`, shared by the body and the fillets through `--notch-ink` |
| Notch position | `fixed top-0`, centred, `z-50` |
| Notch width | `min(84vw, 41.25rem)` — 328px at 390, 660px at desktop |
| Notch height | 56px, 64px at `md` |
| Notch bottom radius | 18px |
| Fillet | 16px inverse radius (`--notch-fillet`) |

The fillet is the whole effect. `.notch-fillet` in `src/styles.css` paints a
16px square with the notch ink *outside* a quarter circle. Two nested
`border-radius` values cannot produce that corner — they always leave a seam or
a step, which reads as a floating pill instead of a notch. Do not replace it
with `rounded` utilities.

### Why the notch is 660px wide

A real MacBook notch is ~6% of the display width. Ours carries the full nav
(logo, three anchors, log in, sign up), so it is 46% at 1440. The silhouette and
the fillets do the work of reading as a notch; the width is a functional
compromise. 660px is the measured floor that keeps the three anchors, both auth
actions and 20px of padding between them at 1440 — the previous 560px version
crowded the nav. Narrowing it further means moving the auth actions out of the
notch.

Width stays viewport-linked below the cap (84vw), so the notch keeps the same
proportion on phones instead of becoming a fixed slab.

### Pinned, not handed over

The notch used to scroll away with the panel, and `HeroStickyNav` slid in once
the panel cleared the viewport. Both are gone: the notch is `fixed` at the
viewport top for the whole page, so there is exactly one nav and no handoff.
`SiteNotchNav` renders in `src/routes/index.tsx`, outside the hero section.

Consequence to keep in mind: the top 56–64px of the centre column is always
covered. Sections need enough top padding and `scroll-mt` (features uses
`scroll-mt-24`) that headings do not land under the notch when anchored to.

### Content

100svh screen, content centred in the section column. Type + CTAs only — the
studio card was removed, the app preview and logo cloud sit below the fold so
the hero stays one idea.

The headline is **three words that form a complete sentence**, with a tagline
under it in the same register:

> **Work finds its place.**
> *Nothing lost.*

with a supporting paragraph under it that names what the product holds.

- H1 is Inter 600 at `clamp(2.5rem, 6.4vw, 5.5rem)`, tracking `-0.045em`,
  leading `0.94`, `text-wrap: balance`. A three-word line wants the larger
  scale; at the old `4.5rem` cap it read as a subhead. At 390 it balances to
  "Work finds / its place." rather than orphaning "place.".
- The tagline is a block span in Instrument Serif italic at
  `calc(clamp(2.5rem, 6.4vw, 5.5rem) - 4px)` — **exactly 4px smaller than the
  headline at every width** (88px vs 84px at 1440, 40px vs 36px at 390), in the
  same ink `#0a0a0a`, not a tinted grey. Name and weight carry the hierarchy;
  colour and size do not. Leading `1.02`, tracking `-0.025em`, `mt-1`.
- **The tagline is capped at two words.** "Nothing lost." is the current pair;
  the two-word limit is a layout rule, not a suggestion — at 84px a longer
  line wraps to two or three lines and becomes a second headline. Two words at
  that size still fit one line at 1440 and at 390.
- **The eyebrow was removed.** "Built for creative teams" sat above the
  headline in a white pill; with the headline + tagline doing the work it was
  a third element before the statement. The h1 is now the first thing in the
  block.
- **The supporting paragraph stays**, below the tagline at `mt-8`: 17px,
  `max-w-xl`, `#2c4650`. It is the only place on the hero that names tasks,
  files and feedback, so it is not decoration — without it the hero never says
  what the product holds. CTA row follows at `mt-8`.

Measured at 1440 (built preview): h1 block 278→451, paragraph 483→538 at
`max-w-xl` (576px), CTAs from 570, microcopy ends 654. Gaps: 214px above the
h1 (from the notch), 246px below the microcopy. At 390: h1 221→337, paragraph
369→479, block ends 655; 165px above, 189px below; `docW` 390 — no horizontal
overflow.

Vertical placement is `flex-1 justify-center` with `pt-32 pb-24`, not an
eyebrow-height top pad. `justify-center` centres the copy in the padding box,
so the block stays optically centred at every viewport height; the 32px
difference between top and bottom padding biases it slightly downward to
compensate for the notch sitting above it. The old `md:pb-40` pushed the block
80px above centre, which is why the hero read top-heavy on short viewports.

Tightening note: the two lines are set at `0.94` and `1.02` leading with a 4px
gap. Loosening either brings back the "stacked blocks" read; the serif and the
sans only share a block if they sit closer than their own line-heights would
suggest.

### Logo cloud — SSR width fix (2026-11-18)

`LogoCloud` picks its desktop row vs the `InfiniteSlider` from
`useMedia("(min-width: 64rem)")`, which starts at `true`. Every SSR response
therefore shipped the non-wrapping desktop row, and at 390 that row ran to
769px — a 379px sideways scroll until hydration swapped it out. The row now
carries `hidden lg:flex`, so it cannot render below `lg` whether or not
hydration has happened. Verified on the built preview: `docW` 390 with the
mobile slider (12 marks, masked edges), desktop still `flex`.


### Hero copy — revised 2026-11-17 (second copy pass)

| Slot | Before | After | Reason |
|---|---|---|---|
| H1 | One home from brief to sign-off | Work finds its place. | The brief asked for a three-word complete sentence. Keeps the home metaphor as a verb, so it is a claim rather than a label. |
| Tagline | where every version lives. | Nothing lost. | Capped at two words by layout. "Finds / lost" makes the pair one idea; the version promise moved into the headline's implication and the paragraph. |
| Paragraph | Tasks, files, and feedback stay with the project… | unchanged, restored below the tagline | It is the only line that names tasks, files, feedback and the version-chasing pain. The tagline no longer repeats it, so it earns its place. |
| Primary CTA | Start your first project | unchanged | Still verb + outcome, and still true of the signup flow. |

Considered and rejected as the H1: "Briefs become approvals." (most specific,
strongest swap test, but it narrates the workflow instead of promising an
outcome), "Nothing gets lost." (generic to any file tool), "Send it once."
(reads as a one-off send).

Other two-word taglines considered: "Nothing strays." (more distinctive, but
"strays" is a word the customer does not use), "Always current." (true of the
version model, reads like a status label), "Nothing missing." (close to
"Nothing lost", less final).

**Swap test note:** "Work finds its place." is the weakest of the four H1
candidates on specificity — any workspace could say it. The pairing is what
makes it Antara's, so if "Nothing lost." ever changes, the headline needs
re-testing. Claims used here: tasks, files/assets, version history per project
and approvals all exist in the data model.




### Nav handoff — removed 2026-11-17

There is no handoff any more. The notch is `fixed` for the whole page, so
`HeroStickyNav` and `usePastElement` were deleted rather than left dormant.

### Motion

One moment: the gradient fades in over 1100ms on load. Everything else is a
200–300ms colour or transform transition. All of it is disabled under
`prefers-reduced-motion`.

---

## Background: authored mesh + meadow

Revised 2026-11-17 (third pass). The hero fill is a **mesh** of three sky
stops plus a grain film, and the product mockup below it sits on a photographed
meadow.

### The hero mesh

Only three colours render in the hero: `#38bdf8`, `#bae6fd`, `#f0f9ff`. They
are laid down in five overlapping layers — a diagonal base, two saturated
radial shoulders at the top, a pale lobe, and a bottom fade — so the field flows
between them instead of stopping anywhere. `.hero-mesh` in `src/styles.css`.

| Layer | Role |
|---|---|
| `linear-gradient(180deg, transparent 60%, #f0f9ff 100%)` | Pins the bottom edge to `--hero-lift` at any aspect ratio, guaranteeing the seam with the mockup section |
| `radial-gradient(58% 50% at 30% 66%, #f0f9ff → transparent)` | Pale lobe the copy sits on |
| `radial-gradient(64% 58% at 88% 44%, #bae6fd → transparent)` | Mid lobe, right — breaks the vertical symmetry |
| `radial-gradient(52% 46% at 78% 4%, #38bdf8 → transparent)` | Right shoulder |
| `radial-gradient(62% 54% at 6% 0%, #38bdf8 → transparent)` | Left shoulder |
| `linear-gradient(145deg, #38bdf8, #bae6fd 50%, #f0f9ff)` | Base flow, deliberately not vertical |

**There is no dark stop, so the copy is ink, not white.** White type would sit
at ~2:1 on `#38bdf8`; `#0a0a0a` sits at 10.3:1 at its worst. That is a type
inversion, not a tuning pass: the badge, CTAs and microcopy all flipped too
(primary is now ink on white type, secondary is ink with a `black/15` ring).

Measured with the copy hidden, worst background luminance under the copy:

| Viewport | h1 | subhead | microcopy |
|---|---|---|---|
| 1440×900 | 0.555 (11.4:1) | 0.759 | 0.852 |
| 390×844 | 0.494 (10.3:1) | 0.580 | 0.810 |

The 72% / 86% / 94% stop tuning from the previous dark version is gone — with a
light field there is nothing to clear. The mobile `justify-start pt-24` and
`md:justify-center md:pb-40` bias stays anyway; it keeps the copy off the
bottom fade.

### The grain

`.hero-grain` is an inline SVG `feTurbulence` (180px tile, `baseFrequency 0.75`)
rendered at `opacity: 0.75` with `mix-blend-mode: overlay`.

The blend mode is the load-bearing part. `overlay` against mid-grey leaves the
mean colour unchanged, which is why the bottom edge still matches the mockup
section exactly (`rgb 241.7,249.3,255` at the last hero row vs
`rgb 238.4,247.6,253.7` at the first mockup row — invisible). A `multiply` grain
would darken the whole field and re-open the seam.

The grain is also what kills banding: a five-layer ramp this shallow steps
visibly on 8-bit panels, and ~7% per-pixel luminance noise dissolves it. Do not
remove it as "decorative". Do not raise it much past 0.75 either — it starts
reading as dirty glass rather than film.

### The mockup section

`public/media/daylight/hero-meadow.jpg` — 3000×2000, 999 KB. Mountain meadow
with wildflowers; the top third is pale sky.

| Layer | Value | Purpose |
|---|---|---|
| Section top | `linear-gradient(to bottom, var(--hero-lift), color-mix(in srgb, var(--hero-lift) 55%) 45%, transparent)` | The first pixel of the section is exactly the last pixel of the hero — the seam is a colour match, not a blur |
| Photo | `object-cover object-[50%_28%]` | Sky and ridgeline at the top, flowers behind the card |
| Section bottom | last 208px to `background` | Hands back to white for the logo cloud |

`--hero-lift: #f0f9ff` in `src/styles.css` is the shared token. The mesh pins
its bottom edge to it and the mockup veil starts from it. **Changing one without
the other restores a visible line between the sections.**

Why it can blend at all: the meadow's own sky is almost the same pale blue as
`#f0f9ff`, so the veil never has to hide a tonal jump — it only has to release
the photo gradually.


The previous images (`hero-gradient.png`, `hero-foliage.jpg`) are no longer
referenced; both are still in `public/media/daylight/` pending a decision to
delete.

---

## Auth — signup backdrop

Decided 2026-11-19. Signup's right-hand testimonial panel uses the hero mesh
instead of the daylight studio photo; login keeps the photo.

`.hero-mesh` now reads its base ramp direction from `--mesh-angle` with a
`145deg` fallback, and `.auth-mesh` supplies `30deg`. Both classes render on the
signup panel, so the five layers and their stops stay one definition — only the
base direction changes. The grain comes along: a ramp this shallow bands on
8-bit displays without it.

The glass card (`bg-black/55`) is unchanged. Over the photo it composites to
near-black; over the pale mesh it lands mid-grey. That is the current state, not
a settled decision — revisit the card if the signup panel reads washed out.


---

## Landing page: open questions

- The page has no theme toggle; `.dark` is defined but unreachable from the
  landing route. The hero is a light sky mesh with ink type in both themes; the
  notch ink stays `#0a0a0a` in both.
- `#features`, `#pricing`, `#faq` anchors must exist in the sections below the
  hero. They did before this change; re-check after any section reorder.
