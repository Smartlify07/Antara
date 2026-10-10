# Project Details Page — implementation plan

Branch `feat/project-details`, worktree `.worktrees/project-details`, forked from `main` @ `14d6759`.

---

## 1. Scope

A Linear-style project details page: two columns, tabbed, with editable attribute
pills, a project activity feed carrying versioned attachments, and a lead approval
workflow.

Delivered as three commits on this branch so each is reviewable.

| Phase | State |
|---|---|
| 1 | **Done** — page shell, tabs, pills (both columns), description, member add / lead change, attribute writes |
| 2 | **Done** — activity feed, composer, Cloudinary uploads, asset versioning, approval |
| 3 | **UI only** — invite dialog and the `__invite__` CTA exist; the service, accept route and backfill hook are not built |

Phase 3 is split out deliberately: handoff §6 treats the invite backfill as a
security-critical unit of work and it should be reviewed alone.

---

## 2. Layout

`pnpm dlx shadcn add tabs` in phase 1. `radix-ui` is already a dependency (the
unified package), so this adds no `package.json` entry.

```
┌──────────────────────────────────────────────────────────────┐
│ ← Projects / Aurora Rebrand                          [ ⋯ ]   │  AppShell breadcrumb
├──────────────────────────────────────────────────────────────┤
│ Aurora Rebrand                                      [ ⋯ ]   │
│ Aurora · PDX                                              │
│ [✦Planning] [👤A.Osei] [👥4] [🏷Brand] [🗓Mar 4]              │ ← pills (left)
│ ┌─ Overview ─┬─ Activities ───────────────────────────┐       │
│ └────────────┴────────────────────────────────────────┘       │
│ ┌── left ─────────────────┬── right ────────────────────┐    │
│ │ 4 tasks · 2 assets      │  [✦Planning][👤A.Osei][👥4] │    │ ← pills (right)
│ │  ───────────────────  │  [🏷Brand][🗓Mar 4]          │    │   editable, same
│ │  Description             │  Lead      A. Osei           │    │   component
│ │  ┌─────────────────┐    │  Members   [stack]           │    │
│ │  │ (borderless)    │    │  Tags      ●Brand ●Launch   │    │
│ │  └─────────────────┘    │  Start     Mar 4             │    │
│                          │  End       Mar 18            │    │
└──────────────────────────┴───────────────────────────────┴────┘
```

The Activities tab swaps the left column for the composer and feed. The right
column is identical on both tabs.

**Pills in both columns are one component, rendered twice** — same props, same
`onChange` handlers, reading the same detail query. Not duplicated markup, so
they cannot drift. Worth a comment in the source, since a later reader will
otherwise be tempted to "clean up" the second render.

### Assumptions

Flagged for correction during build if wrong:

- "Description at the bottom, without the borders" → bottom of the **Overview**
  tab's left column. A bare auto-growing `Textarea` with no card chrome and no
  `<div className="border-b" />` separator (the create form has one at
  `project-create-form.tsx`). Saves on blur with a muted Saved / Saving hint.
  Editable, not read-only.
- The right column keeps the Linear label rows **in addition to** the pills.

---

## 3. Data model

Three migrations, one per phase. Phase 1 needs none — the existing `projects`
and `project_members` tables carry it.

### 3.1 Activity and versioning — shipped as 0010 + 0011

Migration 0010 creates the enum, `project_updates` and `asset_versions` with
`assets` untouched. 0011 then drops and recreates `assets` into its logical
shape. Split so the destructive half is reviewable on its own; both applied and
verified against the dev database.

**`project_updates`** — the feed unit and the approval unit.

```
id, project_id → projects (cascade), author_id → user (set null)
body text not null
review_status update_review_status not null default 'pending'
reviewed_by → user (set null), reviewed_at, review_note text
created_at, updated_at
index (project_id, created_at desc)
```

New enum: `update_review_status = ['pending','approved','changes_requested']`

**`assets`** becomes the logical file identity, matching `Project → Asset →
AssetVersion` in `product-prd.md` and handoff §2 step 7.

```
id, project_id (cascade), task_id? (cascade, for future task threads)
filename text not null
current_version_id → asset_versions (set null)   -- backfilled post-insert
created_by → user (set null), created_at, updated_at
unique (project_id, lower(filename)) where live
```

**`asset_versions`** — the physical uploads, each carrying its label.

```
id, asset_id → assets (cascade)
update_id → project_updates (cascade)   -- which submission it arrived in
version_no integer not null
label text not null                       -- "v1", "v2", …
provider asset_provider not null, provider_key text not null, url text not null
mime_type text not null, size_bytes integer not null
uploaded_by → user (set null), created_at
unique (asset_id, version_no)   unique (asset_id, label)
```

Dropped from `assets`: `provider`, `provider_key`, `url`, `mime_type`,
`size_bytes`, `comment_id` — they move to `asset_versions`.

`assets` had **zero rows** in any environment, so 0011 is a straight
drop-and-recreate.

Version numbering: uploading a filename that already exists in the project
appends the next version to that asset; otherwise it creates the asset at v1.
That is what makes "v1, v2" mean something rather than numbering attachments
within a post.

### 3.2 Project invites — not built

```
id, project_id → projects (cascade)
email text not null
role_id → roles (restrict)              -- project-scope member/lead
token text not null unique              -- SHA-256 hash, not the raw token
expires_at timestamp not null
invited_by → user (set null), accepted_at, created_at
index (project_id), index (lower(email))
unique (project_id, lower(email)) where accepted_at is null
```

Two things recorded deliberately:

1. `workspace_invites.token` stores the **raw** token, contradicting handoff §3
   and §7.6 (hash at rest, ≥32 bytes from a CSPRNG, never reuse the row id).
   The new table hashes properly. The existing flaw is flagged, not fixed here.
2. This creates a second parallel invite concept alongside `workspace_invites`,
   which is divergence from §3's "the invite schema already exists and is unused".

Acceptance must fire on **verified session**, not on user creation. Handoff §6
is explicit that the other order is an account-takeover primitive:
`project_members.email` is set while no `user` row exists, so registering that
address would succeed and grant the project.

---

## 4. Layers

Three-layer convention: `src/lib/queries` (options + keys + optimistic builders)
→ `src/server/functions` (session + zod, HTTP boundary) → `src/server/services`
(pure drizzle).

**Services**

- `project-update-service.ts` (new) — feed, composer transaction (insert update →
  resolve-or-create asset by filename → insert version), review
- `project-invite-service.ts` (new) — create, resend, accept, backfill
- `project-service.ts` (extend) — `getProjectDetail`, `listProjectMembers`,
  `setProjectLead`, `addProjectMembers`, `updateDates`, `updateTags`,
  `updateDescription`

**Queries** — extend `src/lib/queries/projects.ts` with
`projectKeys.detail(workspaceId, slug)`, `projectKeys.updates(workspaceId, id)`,
`projectDetailQuery`, `projectUpdatesQuery`, and `buildOptimisticUpdate()`
alongside the existing `buildOptimisticProject`.

**Routes** — new `w.$workspaceSlug.projects.$projectSlug.tsx`, nesting under the
existing `<Outlet/>` passthrough in `w.$workspaceSlug.projects.tsx`. No
`beforeLoad`; auth inherits from `w.$workspaceSlug`. `useWorkspaceCrumbs` needs a
`$projectSlug` branch, using `useParams({ strict: false })` because the layout
route cannot see the child's param otherwise.

`ProjectCard` needs a `<Link>` wrapper — there is currently no route from the
grid to a details page.

**Components** — `src/components/projects/details/`: `project-detail.tsx`,
`project-pills.tsx`, `project-properties.tsx`, `project-description.tsx`,
`update-composer.tsx`, `update-feed.tsx`, `update-card.tsx`,
`invite-member-dialog.tsx`. `AvatarStack` is currently private to
`member-chip.tsx` and must be exported.

Routes do the queries and pass plain props down, exactly as
`projects.new.tsx` does with `ProjectCreateForm`.

---

## 5. Optimistic updates

Composer, following `project-create-form.tsx`:

`cancelQueries` → snapshot → write an optimistic update with
`URL.createObjectURL` previews and `reviewStatus: "pending"` → clear the composer
→ `onError` restore snapshot → `onSettled` invalidate `updates` + `detail`. The
card renders in a muted "sending" state so it is distinguishable from a settled
post.

Approve / request-changes does the same snapshot-and-rollback on the single
update object.

Attribute pills patch the `detail` cache in place, then invalidate
`projectKeys.list` too, so the grid's member count and status badge stay in sync.

Two specifics to handle:

- Object URLs must be revoked on rollback and unmount. The grid work
  (`projects-grid.tsx:26`) avoided this by never giving optimistic rows blob
  URLs; we cannot avoid it here.
- The optimistic id → real id swap remounts that one card. The grid solved this
  by keying on `slug`; here the card holds no state beyond hover, so the
  remount is accepted rather than paid for with a client-side key column.

---

## 6. Permissions

Enforced server-side in the service layer, matching the `createInvite` precedent
in handoff §6.

| Action | Who |
|---|---|
| View page, post update, attach | workspace member with access |
| Approve / request changes | project-scope `lead`, workspace admin, or owner |
| Edit attributes, add/change lead, invite | workspace admin/owner |

Posting is scoped to *workspace* membership, not *project* membership —
`project_members` exists but nothing gates on it yet. Noted in a comment rather
than silently decided.

---

## 6a. Two things built on the way

**A stale drizzle snapshot, not a code problem.** `drizzle-kit generate` refused
to run — "Interactive prompts require a TTY terminal". The cause predates this
branch: snapshot `0009` still recorded the rate-limit table as `rateLimit`, but
migration `0008` actually creates `rate_limit`. drizzle therefore saw one table
created and one deleted and demanded a rename confirmation, which is
unanswerable without a TTY. Fixed by reconciling `0009_snapshot.json` with what
`0008` really does. **Worth doing on `main` too**, since any future branch with
a schema change hits the same wall.

**`--custom` migrations leave the snapshot untouched.** Used for 0011
(drop-and-recreate, which drizzle cannot infer). `--custom` writes the SQL file
and the journal entry but copies the previous snapshot verbatim, so the snapshot
had to be reconciled by hand or the next `generate` diffs against the old
columns again. Same trap as the `0008` note in handoff §9.

## 7. Prerequisites

Blocking, and outside what I can do:

1. **Secrets come from Doppler, not `.env`.** The main repo has no `.env` file
   at all — everything runs as `doppler run -- <command>`. Set
   `BETTER_AUTH_URL=http://localhost:3000` in the dev Doppler config or local
   auth 403s on every sign-in POST (handoff §5).
2. **Widen the Cloudinary unsigned preset** to allow `video` and `raw`
   alongside `image`, and raise the file-size cap. Client-side only, no new
   server secrets.
3. `tabs` must be added via the shadcn CLI.
4. `react-start@1.168.59` blocks all Vercel preview deploys (handoff §8) — no
   preview URL for this branch until that moves.
5. The `.worktrees` entry added to `.gitignore` is uncommitted on `main`.
6. `workspace_invites.token` stores the raw token (handoff §3, §7.6 disagree) —
   flagged, not fixed here.

### 7a. Round two

Landed on top of phases 1–2, as commit `feat: refine details page tabs, post
kind and title editing`:

| Change | Notes |
|---|---|
| Larger tabs with a sliding indicator | `TabsSwitcher` replaces the raw `TabsList`. The indicator is placed by index (`translateX(index * 100%)`) rather than measured, since the triggers are equal-width. Transition is disabled for the first paint so the pill does not slide in on load. |
| Post kind — comment or progress update | New `update_kind` enum on `project_updates` (migration 0012), defaults to `comment`. Chosen in the composer via a segmented toggle; the feed renders progress updates with a badge. |
| "Sending…" removed from feed cards | The card already dims at `opacity-60` while in flight, which carries the state. The pending review badge is now blank rather than reading "Awaiting review" on every card, since most posts are comments that nobody is reviewing. |
| Duplicate status row removed | The Overview stat row repeated the Status already shown in the right column next to the pill that edits it. |
| Title editable inline | `ProjectTitle` — click to edit, saves on blur/Enter, abandons on Escape. The slug is deliberately not re-derived, matching the immutability comment at `projects.ts:41`. |
| Optimistic across every attribute write | Two writes were previously awaited-then-refetched: adding members and replacing tags. Both now patch the detail cache first. Member adds append the resolved rows; a tag replace maps the whole set, giving new labels a placeholder id so React keeps the key stable across the swap. |
| Archive / unarchive on the card is optimistic | `ProjectCard.run` takes an optional cache patch applied before the write and restored on failure. Status changes patch this row in place. |
| Trash is deliberately **not** optimistic | Removing the row unmounts the card, taking the confirm dialog and the error banner with it — a rejected trash would restore the card with nothing to explain why. Left awaiting, with the reason in a comment, until there is a toast surface. |

### 7c. Only progress updates are reviewable

Comments cannot be approved or have changes requested — approval is about
whether work is accepted, which is a question about a submission, not about a
remark.

Rather than filtering in the UI, `review_status` became **nullable**
(migration 0013) so `NULL` means "not reviewable" and `pending` means
"reviewable, not yet looked at". Leaving comments at `pending` implied a queue
of approvals nobody works through, and every comment card would have shown an
"Awaiting review" badge with no way to clear it.

The rule is enforced in three places:

- `createProjectUpdate` writes `review_status: null` for a comment.
- `reviewProjectUpdate` requires `kind = 'progress_update'` **in the WHERE
  clause**, so a comment cannot be given a decision even if a crafted request
  reaches the endpoint. The lead check is separate and still runs first.
- The card renders a badge, a review note and the approve/request controls only
  when `reviewable && reviewStatus === "pending"`. Gated explicitly on the kind
  rather than relying on the null status alone, so the rule stays readable.

`buildOptimisticUpdate` mirrors the service, so an optimistic comment does not
flash a review state before the refetch corrects it.

### 7b. Optimistic posting, and a rollback bug in it

Posting was optimistic from the start, but the rollback had a defect that only
appears on a project's **first** ever post: `onMutate` captured the cache with
`getQueryData`, which returns `undefined` when the feed has never been
populated, and `onError` guarded on `if (context?.snapshot)`. A failed first
post therefore skipped the restore entirely and left the optimistic row
stranded in the feed with no way to remove it.

Three changes, all in the same direction:

- The snapshot is coerced to `[]`, so the restore branch always runs.
- Rollback drops **only** the failed post, by id, instead of restoring the
  whole list. A whole-list restore reverts anything else that landed in the
  feed while the write was in flight — including another person's update.
- The review mutation on the card had the same shape and the same weakness; it
  now reverts its own row's status rather than a whole-list snapshot.

Deliberately **not** cleared on failure: the composer text and the staged
files. A rejected post should be retryable without retyping it, and the
previews are still referenced by the chips rather than by the removed row — so
revoking those object URLs there would break the retry.

Also removed the separate `uploading` state. The upload runs inside
`mutationFn`, so `mutation.isPending` already spans it; the extra flag tracked
the same thing a moment later and could disagree with itself.

One consequence worth being explicit about: because the optimistic row is
written before the upload starts, a provider failure rolls back *after* the
post has already appeared. The previous comment claimed the upload ran first to
avoid that, which was never true — `onMutate` is awaited before `mutationFn`.
The comment was corrected rather than the behaviour.

---

## 8. Verification

`pnpm typecheck`, `pnpm lint`, `pnpm check`, `pnpm test`, `pnpm build`, plus
direct DB queries against each migration.

Per handoff §10 I cannot verify routing, optimistic reconciliation, or approval
permission edges in a browser. I will say so rather than claim the feature
works.

---

## 9. Out of scope

Tasks UI (handoff step 6 — this page is its natural host), notifications,
real-time, removing members, and the client/reviewer role (already ruled out in
handoff §2).