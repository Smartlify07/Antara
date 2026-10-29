# Frontend health audit

_Scope: `src/components`, `src/hooks`, `src/lib`, `src/routes`. Excludes `src/server` and `src/db` (backend). Generated 2026-10-29._

Audit against five criteria:

1. Unnecessary `useEffect`s
2. Files over 120 lines
3. Multiple components per file (except reusable primitives)
4. Logic inside components
5. Repeated logic instead of shared hooks/helpers

---

## Summary

| # | Criterion | Verdict | Top offenders |
|---|---|---|---|
| 1 | Unnecessary useEffects | Mostly clean; a few prop→state sync effects | `library-filters`, `project-title`, `project-description`, `workspace-form` |
| 2 | Files > 120 lines | ~50 files fail; 4 exceed 400 | `deliverables-cabinet` (1817), `variant-c` (960), `variant-b` (773), `variant-a` (734), `library-folders` (708) |
| 3 | Multiple components per file | Several god-files + co-located sub-components | `deliverables-cabinet`, `library-folders`, `member-chip`, `nav-main`, `features-3` |
| 4 | Logic in components | Helpers/hooks inline in component files | `project-cover-art`, `library-folders`, `member-chip`, `nav-main`, `request-form-chips` |
| 5 | Repeated logic | FNV hash ×4, `initials` ×5, `toDateString`≡`toIsoDay`, avatar-fallback ×N | see §5 |

The single largest structural problem is **`deliverables-cabinet.tsx` (1817 lines)** — a god-file with 11 sub-components, an inline helper, and inline constants. It is also shadowed by a **~3000-line `folder-experiments/` prototype** that only the dev route imports.

---

## 1. Unnecessary `useEffect`s

`useEffect` appears 55 times across the frontend. Nearly all are legitimate (DOM focus/scroll, `matchMedia`, interval rotation, keyboard/outside-click listeners, service-worker registration, object-URL cleanup, post-mount localStorage reads for SSR hydration).

The only candidates for "unnecessary" — the **prop→state sync** family, which React's docs discourage in favour of deriving during render or keying a subtree:

| File | Line | Pattern | Note |
|---|---|---|---|
| `components/library/library-filters.tsx` | 64 | `setTerm(filters.q)` on `filters.q` change | URL-backed search input; defensible but is the classic sync-into-state effect. Alternative: reset via `key` on the input, or track previous prop during render. |
| `components/projects/details/project-title.tsx` | 33 | `if (!editing) setDraft(title)` | "Adopt server changes while idle." Borderline; the `!editing` guard is correct but it's still a prop-sync effect. |
| `components/projects/details/project-description.tsx` | 32 | `if (!focused) setDraft(description)` | Same pattern as above. |
| `routes/w.$workspaceSlug.library.index.tsx` | 246 | `setExpandedId(null)` on `targetProject` | State reset on prop change. Cleaner: give the subtree a `key={targetProject}`. |
| `components/workspaces/workspace-form.tsx` | 77 | `form.setValue("slug", slugifyName(name))` | react-hook-form explicitly recommends against `setValue` in an effect; derive the slug at submit / on change instead. |

**Not flagged** (and correctly documented as necessary): `login.tsx` (post-sign-in redirect — `beforeLoad` can't observe a session created on-page), `not-found.tsx` / `verify-email.tsx` (SSR-hydration-safe post-mount reads), `use-push.ts`, `use-media.ts`, `use-mobile.ts`, and the DOM/scroll/focus effects in `request-thread`, `my-tasks-page`, `workspace-search`, `project-title` (focus), `project-description` (auto-grow), `tabs-switcher` (deferred transition), `app-shell` (debounced last-opened-workspace write), `testimonial-panel` (rotation), `empty-state-graphic` / `hero-section-2-header` (media query).

---

## 2. Files over 120 lines

Threshold: **> 120 lines**. 51 frontend files exceed it. `routeTree.gen.ts` (generated) and vendored `ui/*` / `animate-ui/icons/*` are excluded from the counts below.

### Critical (> 400 lines)

| File | Lines |
|---|---|
| `components/projects/details/deliverables/deliverables-cabinet.tsx` | 1817 |
| `components/projects/details/folder-experiments/variant-c.tsx` | 960 |
| `components/projects/details/folder-experiments/variant-b.tsx` | 773 |
| `components/projects/details/folder-experiments/variant-a.tsx` | 734 |
| `components/library/library-folders.tsx` | 708 |
| `components/projects/details/folder-experiments/mock.ts` | 547 |

The `folder-experiments/` tree (3014 lines total across 4 files) is prototype code imported **only** by `routes/dev.deliverables.tsx`. `deliverables-cabinet.tsx` is the productionized rewrite ("Variant C concept… wired to the real data" per its own header). The experiments are effectively dead weight in the main bundle path and should be deleted once the cabinet is confirmed.

### Severe (240–400 lines)

`task-row.tsx` (400), `accept-request-dialog.tsx` (397), `w.$workspaceSlug.library.index.tsx` (373), `notification-bell.tsx` (361), `member-chip.tsx` (341), `task-detail-page.tsx` (334), `new-task-dialog.tsx` (321), `project-card.tsx` (305), `workspace-form.tsx` (292), `request-form-chips.tsx` (284), `asset-detail-page.tsx` (276), `new-deliverable-dialog.tsx` (251), `task-composer.tsx` (246).

### Warning (121–240 lines)

`invite.$token.tsx` (238), `library-filters.tsx` (235), `use-project-pills.ts` (235), `request-thread.tsx` (232), `version-composer.tsx` (215), `project-create-form.tsx` (214), `project-properties.tsx` (202), `invite.pending.tsx` (196), `submit-request-form.tsx` (194), `team/invite-dialog.tsx` (194), `auth/signup-form.tsx` (190), `hero-app-preview.tsx` (183), `project-detail-page.tsx` (183), `lib/queries/tasks.ts` (181), `invite-member-dialog.tsx` (181), `request-triage-bar.tsx` (181), `lib/queries/deliverables.ts` (175), `request-detail.tsx` (173), `workspace-switcher.tsx` (173), `features-3.tsx` (166), `nav-main.tsx` (165), `team/team-members.tsx` (153), `app-sidebar.tsx` (152), `w.$workspaceSlug.requests.index.tsx` (152), `lib/project-schemas.ts` (147), `verify-email.tsx` (140), `auth/login-form.tsx` (137), `deliverable-meta.ts` (137), `dates-chip.tsx` (134), `auth/resend-verification.tsx` (133), `work-comments.tsx` (133), `app-shell.tsx` (133), `workspace-search.tsx` (130), `hooks/use-push.ts` (129), `version-thread.tsx` (129), `tags-chip.tsx` (127), `lib/queries/versions.ts` (122).

Note: most 121–240-line files are acceptable *shape* (one dialog/form = one file). The "warning" band is where a second split is worth weighing, not an automatic fail.

---

## 3. Multiple components per file

The reusable-primitive exception (shadcn `ui/*`, `animate-ui/icons/*`, `projects/chip.tsx`, `projects/dates-chip.tsx`, `member-chip.tsx`'s shared pills) is respected. Remaining offenders:

| File | Sub-components / exports |
|---|---|
| `deliverables-cabinet.tsx` | `MasterPane`, `LevelZeroList`, `LevelOne`, `LevelTwo`, `VersionPager`, `TaskListItem`, `DetailTabs`, `Dot`, `MetaBadge`, `TintedAvatar`, `NeutralAvatar` + `DeliverablesCabinet` (12 total) |
| `library-folders.tsx` | `FolderCutout`, `LibraryFolderWall`, `AssetBook`, `AssetRecordSheet` + 9 helpers |
| `member-chip.tsx` | `PersonRow`, `AvatarStack`, `LeadChip`, `OwnerChip`, `MembersChip` + `useFiltered` + 2 helpers (the pills are shared/reusable — the hook and helpers are the issue) |
| `nav-main.tsx` | `SoonBadge`, `NavBadge`, `NavIcon`, `NavRow` + `useRowActive` hook |
| `features-3.tsx` | `ReviewPanelIllustration`, `LibrarySearchIllustration`, `ApprovalIllustration` |
| `request-form-chips.tsx` | `CategoryChip`, `PriorityChip`, `DeadlineChip`, `ReferenceLinksChip` + `priorityLabel`, `toDateString` |
| `accept-request-dialog.tsx` | `ProjectStatusPill`, `ProjectPickChip` |
| `asset-detail-page.tsx` | `VersionRow`, `DecisionLine` + `displayName` |
| `project-properties.tsx` | `StatusValue`, `Row`, `Placeholder`, `AvatarStack` |
| `task-detail-page.tsx` | `TaskDetailContent`, `TaskThread` |
| `request-detail.tsx` | `RequestMetaRow`, `RequestDetailBody` |
| `notification-bell.tsx` | `UnreadOrb`, `MessageText`, `NotificationsInbox` |
| `request-thread.tsx` | `MessageRow` |
| `features-4.tsx` | `DynamicIslandIllustration` |

The rule of thumb to encode: **page-specific sub-components (illustrations, view panes) should live in a folder, not stacked in one file.** Reusable pill families are fine co-located.

---

## 4. Logic inside components

The query layer is genuinely clean — every `useQuery`/`useMutation` reads a named query option from `lib/queries/*` (verified: no `queryFn:` is defined inside a component). The problem is **pure helpers and hooks living in component files**:

| File | Inline logic |
|---|---|
| `components/workspace/project-cover-art.tsx` | `hash()` + `projectCoverColor()` + `BRIGHT_COLORS` — pure color derivation in a component file |
| `components/library/library-folders.tsx` | `hash`, `bookColorOf`, `countOf`, `domainOf`, `sourceLabel`, `formatFullDate`, `initialsOf`, `tintOf`, `folderMetaLine` |
| `components/projects/member-chip.tsx` | `useFiltered` hook + `initials`/`displayName` helpers |
| `components/nav-main.tsx` | `useRowActive` hook (should be `hooks/use-row-active.ts`) |
| `components/requests/request-form-chips.tsx` | `priorityLabel`, `toDateString` |
| `components/requests/request-avatar.tsx` | `initials` |
| `components/nav-user.tsx` | `initials` |
| `components/library/asset-detail-page.tsx` | `displayName` |
| `components/projects/details/deliverables/work-comments.tsx` | `initialsOf` |
| `components/workspaces/workspace-form.tsx` | debounced slug-availability check inline (candidate for `hooks/use-slug-availability.ts`) |

---

## 5. Repeated logic

Concrete duplications found (the same code, not the same concept):

### 5.1 FNV-1a `hash(value)` — 4 identical copies

```
lib/tag-colors.ts:23            (seed 2166136261, Math.imul 16777619)
lib/avatar-tint.ts:20           (identical)
components/workspace/project-cover-art.tsx:12   (identical)
components/library/library-folders.tsx:57       (identical)
```

→ Extract to `lib/hash.ts` (or `lib/utils.ts`) and import everywhere.

### 5.2 `initials(...)` — 5 near-identical copies

```
components/requests/request-avatar.tsx:4   initials(name)
components/nav-user.tsx:21                  initials(name, email)
components/projects/member-chip.tsx:34      initials(member)        (exported)
components/library/library-folders.tsx:159  initialsOf(person)
components/projects/details/deliverables/work-comments.tsx:135  initialsOf(message)
```

Each re-implements "split on space → first char → 2 → uppercase → fallback". The member-chip version is exported but not reused by the others.

### 5.3 Date → ISO-day string — 2 identical copies

```
lib/time.ts:34                    toIsoDay(date)
components/requests/request-form-chips.tsx:44   toDateString(date)
```

Byte-for-byte the same pad/join. `request-form-chips` should import `toIsoDay`.

### 5.4 Avatar-with-tint fallback — N ad-hoc copies

`avatarTint()` (in `lib/avatar-tint.ts`) and `RequesterAvatar` exist, yet the "image-or-initial + tinted fallback" block is hand-rolled in `workspace-search.tsx`, `workspace-switcher.tsx`, `workspace-form.tsx` (`AvatarPreview`), and `nav-user.tsx`. A single `<PersonAvatar>` primitive would collapse these.

### 5.5 `matchMedia` / reduced-motion — 3 implementations

`hooks/use-media.ts` (generic) and `hooks/use-mobile.ts` (specialised) exist, but `empty-state-graphic.tsx` and `hero-section-2-header.tsx` each re-implement a media-query effect, and `testimonial-panel.tsx` reaches for framer's `useReducedMotion` instead. Consolidate on `use-media`.

### 5.6 `displayName(...)` — 2 copies

`components/projects/member-chip.tsx:44` and `components/library/asset-detail-page.tsx:294`.

---

## Recommended priority order

1. **Delete `folder-experiments/`** (3014 lines of prototype) once `deliverables-cabinet` is confirmed — also removes one `hash` copy and one `initials` copy.
2. **Split `deliverables-cabinet.tsx`** into a `deliverables/` folder of view components (its 11 sub-components map cleanly to files).
3. **Extract `lib/hash.ts`, `lib/initials.ts`, `lib/person.ts`** (initials + displayName + tint) and replace the 4×hash / 5×initials / 2×displayName copies.
4. **Replace `toDateString` with `toIsoDay`**, consolidate media-query logic on `use-media`.
5. **Move the prop→state sync effects** (§1) onto `key` props or render-time derivation as you touch those files.
6. **Move inline hooks/helpers** (`useRowActive`, `useFiltered`, `projectCoverColor`, `library-folders`' 9 helpers) into `hooks/` and `lib/`.
