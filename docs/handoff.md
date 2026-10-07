# Antara — session handoff

_Last updated: 2026-10-07. Captures current state, decisions made, agreed sequence, and known risks._

---

## 1. Where the project stands

Shipped and merged to `main` (8 PRs, all merged):

| Area | State |
|---|---|
| Auth | Email + password, Google OAuth, split-screen UI with animated testimonials |
| Workspaces | Create with slug/handle + Cloudinary avatar, roles seeded per workspace |
| App shell | Collapsible-icon sidebar, workspace switcher, breadcrumbs, grouped nav |
| Projects | Grid with bright cover art, status badge, tags, archive/trash with confirm |
| Project creation | `/w/:slug/projects/new` — chip-based status/lead/members/tags/dates |
| Data layer | Drizzle + Neon via node-postgres, 6 migrations, file-per-entity schema |
| UX | Optimistic project creation with rollback, Framer Motion reveal, View Transitions |

**Not yet built:** task UI, asset versioning, asset upload UI, notifications, real-time, approvals workflow.

### Pending migrations

Merged but not applied to your database:

```
doppler run -- pnpm db:migrate      # 0005 start_date, 0006 tags.color
doppler run -- pnpm db:seed:demo    # backfills tag colours on demo tags
```

---

## 2. Agreed execution sequence

1. **Team invites + joining a workspace**
2. **Email verification + signup backfill** (depends on 1)
3. **Team management** — change role, suspend, remove (schema exists, UI disabled)
4. **Tasks**
5. **Asset versioning** — `asset_versions` table, current-version pointer

Clients/reviewers as a product concept are **out of scope** for now. This resolves an earlier contradiction: the schema enforced "workspace membership is a prerequisite for project membership," which was incompatible with project-only clients.

---

## 3. Invite feature decisions

| Decision | Choice |
|---|---|
| Email delivery | Resend, with an HTML template in code |
| Who can invite | Workspace admins/owners, enforced server-side |
| Token storage | SHA-256 hash at rest; only the hash is stored |
| Token lifetime | Short expiry **and** single-use via `acceptedAt` |
| Template variables | All interpolated values escaped |
| Rate limiting | Database-backed (not in-memory — see §5.4) |
| Provider errors | Sanitised; details logged server-side only |

The invite schema already exists and is unused: `workspace_invites` and `team` (with nullable `user_id`/`email`) support pending invitees. No migration needed — this is mostly wiring.

---

## 4. Security posture (agreed)

| Area | Practice |
|---|---|
| Invite tokens | Hashed at rest, compared on accept |
| Token lifetime | Expiry + single use |
| Email verification | **Required** before an invite can be claimed |
| Backfill hook | Fires on *verified session*, not user creation |
| Authorization | Server-side admin/owner check on every invite endpoint |
| Template rendering | All variables escaped |
| Abuse control | Database-backed rate limiting |
| Provider errors | Sanitised |
| Trusted origins | Production URL only — **wildcard dropped** |

**The load-bearing decision was requiring email verification.** Without it, the backfill is an account-takeover primitive: `team.email` is set for a pending invitee while no `user` row exists, so registering that address *succeeds*, and the backfill grants the attacker the workspace. Hooking the backfill on the verified session closes it — an attacker can register but never reaches the state where the invite matches.

---

## 5. Open security findings

### 5.1 Signup is a global user-enumeration oracle — **live in production, high severity**

`user.email` is UNIQUE. A duplicate signup returns `USER_ALREADY_EXISTS`, and our form renders it deliberately:

```
src/components/auth/signup-form.tsx:23
"An account with this email already exists. Try logging in instead."
```

That is an unauthenticated, unlimited, scriptable oracle over the whole user base — who uses the product, and by extension which studios and brands. It is **not** introduced by invites; it shipped earlier.

**Fix (cheap, and verification makes it natural):** since signup now sends a verification email on *every* attempt, the response no longer needs to signal anything. Both cases return success identically:

> "Check your inbox — if that address can be used, you'll get a verification link shortly."

Honest for new users, non-committal for existing ones, and impossible to bypass because there's no branch on the lookup. Add per-IP signup rate limiting.

### 5.2 Emails are not normalised — medium, breaks invites silently

Nothing lowercases or trims emails on write or read, and the UNIQUE index is case-sensitive.

1. Admin invites `ada@studio.com`
2. Real user signs up as `Ada@studio.com` — a different string, so signup *succeeds*
3. Backfill `WHERE email = 'ada@studio.com'` matches zero rows
4. They verify, land in the app, and are **not in the workspace** — no error shown

**Fix:** normalise at the database level (lowercase generated column or check constraint), and put the unique index on the normalised value — otherwise both variants can still register.

### 5.3 `createInvite` must scope its membership check

- ✅ "Is this email already in **my** workspace?" — leaks only what the admin knows
- ❌ "Does a **user row** with this email exist?" — a workspace admin enumerates the whole product

Same endpoint, very different exposure. Write the scoped version deliberately, with a comment, so a future refactor doesn't globalise it.

### 5.4 Rate limits must be database-backed

You're on Vercel serverless. In-memory counters are per-instance and reset on cold start, so they are bypassed by simply hitting a different instance. Store counters in Postgres.

Key on **all three**: per-admin (one compromised account), per-workspace (colluding admins), per-recipient (stops using the form as a spam cannon aimed at one victim). The third is the one usually forgotten.

### 5.5 Don't attribute invites in the UI

If the workspace list renders "Invited by Priya", anyone who can verify an arbitrary address learns who invited them to which company — a targeted reconnaissance tool. Render invited workspaces identically to created ones.

### 5.6 Token entropy

Token validity is observable (`invalid` / `expired` / `already accepted`), which is only exploitable if tokens are guessable. Use ≥32 bytes from a CSPRNG. Never use `workspace_invites.id` as the token — it's a UUID, and invite tokens must not be enumerable or short-lived-UUID-guessable.

---

## 6. Known issues and tech debt

| Item | Impact |
|---|---|
| **`trustedOrigins` is not on `main`** | See §7 — production has no explicit origin config |
| `gradient_end` column | Dead weight; the card only reads `gradient_start` |
| Tag colours | Derived from a label hash; **no user picker** exists yet |
| View Transitions | Only programmatic navigation animates; `<Link>` clicks (sidebar, breadcrumbs) don't |
| TanStack upgrade | `react-start@1.168.59` blocks all Vercel preview deploys (known XSS, CVE-2026-…). react-router must move in lockstep — it removed `createFileRoute`'s `server.handlers`, which broke the auth route |
| Browser support | View Transitions are Chrome/Edge 111+ only; graceful elsewhere |

---

## 7. Trap worth remembering: orphaned branch

`feat/auth-origins-db-env` (commit `aef719a`) contains `trustedOrigins` config and was **never merged**. `main` has no `trustedOrigins` at all.

Two lessons:

1. **Production currently runs without explicit trusted origins.** better-auth falls back to deriving the origin from the incoming request, which mostly works but is exactly the kind of thing that should be explicit. Worth landing deliberately — with production only, since the wildcard is now rejected.
2. That branch's config still contains `https://*.vercel.app`, which trusts *any* Vercel project. Don't merge it as-is.

The same session produced a related bug worth remembering: `document.startViewTransition` was extracted to a variable and called detached, losing the `Document` receiver and throwing `TypeError: Illegal invocation`. Inside a patched `router.history.push`, that killed every navigation — login never redirected and `/dashboard` spun forever. Fixed in `695620d` by removing the history patch and wrapping only awaited call sites.

---

## 8. Verification habits

- **Secrets live in Doppler.** Run anything needing credentials as `doppler run -- <command>`. A plain shell has no `DATABASE_URL`.
- **Run migrations after pulling** any branch with schema changes, or queries fail on missing columns.
- **What I can verify:** typecheck, build, HTTP status codes, server logs. **What I can't:** anything client-side or visual — routing behaviour, animation timing, permission edge cases in a browser. Say so rather than claiming a feature works.
