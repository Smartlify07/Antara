# Antara — session handoff

_Last updated: 2026-10-08. Captures current state, decisions made, agreed sequence, and known risks._

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
| Data layer | Drizzle + Neon via node-postgres, 9 migrations, file-per-entity schema |
| UX | Optimistic project creation with rollback, Framer Motion reveal, View Transitions |

**Open PR #9** — `fix/auth-enumeration-and-verification` (commits `badccea`, `f467bd5`). Not merged. Contains: signup enumeration fix, email verification, email normalisation on three tables, Postgres rate limits, production-only `trustedOrigins`, and the `rate_limit` table correction.

**Not yet built:** task UI, asset versioning, asset upload UI, notifications, real-time, approvals workflow, the `/verify-email` landing route (§4).

### Migrations — all applied

All 9 (0000–0008) are applied to the dev database, verified against `drizzle.__drizzle_migrations`. No pending migrations.

```
0007_mighty_human_torch.sql        email normalisation indexes + WRONG rateLimit table
0008_fix_rate_limit_table.sql      drops it, creates correct rate_limit
```

`0007` is intentionally left wrong in history — it was already applied, and editing an applied migration invalidates its hash in `__drizzle_migrations`. The pair `0007` + `0008` is correct in sequence. **Note `0008` is on the unmerged PR #9; any environment without it will throw `SCHEMA_MISMATCH` on every auth request.**

---

## 2. Agreed execution sequence

1. **Rotate exposed secrets** — §5
2. **`/verify-email` landing route + resend form** — §4. The last untested piece of the auth flow
3. **Team invites + workspace joining** — schema `workspace_invites`/`team` exists and is unused
4. **Invite backfill hook** — must fire on *verified session*, see §6
5. **Team management** — change role, suspend, remove (schema exists, UI disabled)
6. **Tasks**
7. **Asset versioning** — `asset_versions` table, current-version pointer

Clients/reviewers as a product concept are **out of scope**. This resolves an earlier contradiction: the schema enforced "workspace membership is a prerequisite for project membership," which was incompatible with project-only clients.

---

## 3. Invite feature decisions

| Decision | Choice |
|---|---|
| Email delivery | Resend, with an HTML template in code |
| Who can invite | Workspace admins/owners, enforced server-side |
| Token storage | SHA-256 hash at rest; only the hash is stored |
| Token lifetime | Short expiry **and** single-use via `acceptedAt` |
| Template variables | All interpolated values escaped |
| Rate limiting | Database-backed (not in-memory — see §7.4) |
| Provider errors | Sanitised; details logged server-side only |
| No "invited by" attribution | Render invited workspaces identically to created ones (§7.5) |

The invite schema already exists and is unused: `workspace_invites` and `team` (with nullable `user_id`/`email`) support pending invitees. No migration needed — this is mostly wiring.

---

## 4. Email verification — how it actually works

**Read this before changing anything about verification.** All of it was verified by reading better-auth 1.7.6 source, not inferred.

### The token is a JWT, not a database lookup

`createEmailVerificationToken` (`email-verification.mjs:14-20`) signs an HS256 JWT with `BETTER_AUTH_SECRET`. Payload is `{ email, updateTo, requestType }`. There is **no `verification` table row** for email verification, and no `generateVerificationToken` option exists in 1.7.6's `emailVerification` config.

### Why OTP input boxes are not possible

You asked for six square inputs instead of the "check your inbox" message. That cannot work with better-auth's own verification:

- `verifyEmail` runs `jwtVerify(token, secret)` — a 6-digit string is not a valid JWT and fails immediately
- `generateVerificationToken` does not exist in the options type (checked the full `init-options` type)
- Minting a token ourselves is not an option either: `jwt.payload.email` must be the address, so it requires signing with `BETTER_AUTH_SECRET`

Wiring squares to a link would make the boxes decorative — strictly worse than the current message.

### Decision: Option 2 — keep the link

No code-based verification. Reasons: clicking a link is fewer steps than typing six digits, no new attack surface, zero added risk, and it preserves better-auth's session/flag handling.

The third option (third-party email-OTP service) would mean abandoning better-auth's verification entirely and duplicating rate-limit work. Not worth it.

### The `/verify-email` route is a status page

Because the verification endpoint performs the work then redirects to `callbackURL` itself:

| Outcome | Destination |
|---|---|
| Success | `callbackURL` with **no query params** |
| Failure | `callbackURL?error=TOKEN_EXPIRED` (slug, not prose) |

Possible error slugs: `TOKEN_EXPIRED`, `INVALID_TOKEN`, `USER_NOT_FOUND`, `INVALID_USER` (`email-verification.mjs:167-192`).

Two useful properties, both verified in source:

- **Link replay is safe** — already-verified users short-circuit to a success redirect (line 287)
- **Opening in another browser works** — `autoSignInAfterVerification` defaults true, so a session is created and the cookie set (line 297)

### Current bug: the link lands on the starter page

`sign-up.mjs:243` defaults `callbackURL` to `/` when the client sends none, and ours sends none. So verification works today but drops the user on the untouched TanStack placeholder (`index.tsx` — "Project ready!"). Not a 404; worse, it looks like success. Fix by passing `callbackURL: "/verify-email"` to `signUp.email`.

`SIGNUP_MESSAGE` in the signup form must stay byte-identical — see §7.1.

### The resend form is the only recovery path

Not a nicety. Because `requireEmailVerification: true`, an existing address takes better-auth's `shouldReturnGenericDuplicateResponse` branch (`sign-up.mjs:155`), which returns a **synthetic user with `token: null`** and does **not** re-send the verification email — that requires `onExistingUserSignUp`, which we have not configured (line 201-202).

So today, someone whose link expired (48h) or was filtered has no route back:

| Path | Result |
|---|---|
| `/login` | Blocked by `requireEmailVerification` — "check your inbox" |
| `/signup` again | Generic duplicate response, no email sent |
| `resendVerificationEmail` | Written in `auth-client.ts`, **called by nothing** |

Dead end. The resend form closes it, and wires up dead code.

### `trustedOrigins` stays production-only

Worth knowing, since it looks like it should break dev: `originCheck` validates `callbackURL` against `trustedOrigins`, but `matchesOriginPattern` returns `true` for any **root-relative** URL when `allowRelativePaths` is set (`trusted-origins.mjs:89`), and `verifyEmail` passes that flag. So `/verify-email` validates without localhost ever needing to be trusted. No weakening required.

---

## 5. Environment audit — 2026-10-08

Checked against the live Doppler config and the live Resend API, not assumed.

| Variable | State |
|---|---|
| `RESEND_API_KEY` | Set and valid (200 on `/domains`) |
| `EMAIL_FROM` | Set — `Antara <noreply@smartlify.xyz>` |
| `BETTER_AUTH_SECRET` | Set (32 chars) |
| `BETTER_AUTH_URL` | Set to `https://antara-lyart.vercel.app` — **production**. See below |
| `DATABASE_URL_UNPOOLED` | Set — used by `drizzle.config.ts` |
| `DATABASE_URL_POOLED` | Set |
| `GOOGLE_CLIENT_ID` / `_SECRET` | **Missing** |
| `VITE_BETTER_AUTH_URL` | Set (`http://localhost:3000`) — pinned, see §9 |

### Email delivery — VERIFIED WORKING

Earlier in this session it was broken and failed *silently*: `EMAIL_FROM` was unset, so `sendEmail` fell back to `Antara <no-reply@updates.antara.app>`, a domain absent from the Resend account. Resend returned `403 domain is not verified`. Because `sendEmail` is deliberately fail-soft and logs server-side only, the user-visible symptom was "check your inbox", nothing arriving, login blocked — with no diagnosis anywhere.

Fixed by verifying `smartlify.xyz` and setting `EMAIL_FROM`. Verified against the live API:

```
domains: smartlify.xyz   status: verified   region: eu-west-1
send:    200  {"id":"01a11aa2-..."}
```

A real message was accepted for delivery. **Still worth one manual check**: that it renders correctly in a real inbox (client CSS stripping, link formatting) — an API `200` proves delivery, not presentation.

### `BETTER_AUTH_URL` must differ between dev and prod

It was set to the production URL, which breaks local development: requests from `http://localhost:3000` fail the origin check with `403 INVALID_ORIGIN` on every sign-in/sign-up POST, and verification links generated locally point at production.

**No code change is needed.** `getTrustedOrigins` auto-adds the baseURL origin to `trustedOrigins` (`helpers.mjs:73-74`), and `getBaseURL` reads `BETTER_AUTH_URL` from the env (`url.mjs:71`). So set `BETTER_AUTH_URL=http://localhost:3000` in the dev Doppler config and keep the production URL in the prd config — localhost becomes trusted automatically, alongside the hardcoded `PROD_ORIGIN` in `auth.ts`. The hardcoded entry is additive, not a blocker.

### Three accounts are locked out

`requireEmailVerification: true` blocks sign-in for anyone with `email_verified = false`. Three exist right now:

```
smartlify09@gmail.com
meetdolapoolawale@gmail.com
anosikeobinna895@gmail.com
```

Fix with `update "user" set email_verified = true where email = '...'` (note `"user"` is a reserved SQL keyword and must be quoted), or send a verification email — which now works.

### Action: rotate exposed secrets

`BETTER_AUTH_SECRET`, `RESEND_API_KEY` and the Neon connection string (including the DB password) were printed into a session transcript by a careless diagnostic command on 2026-10-08. Treat all three as compromised and rotate them. Re-fetch the Neon URL afterwards — it changes on rotation.

---

## 6. Security posture (agreed)

| Area | Practice |
|---|---|
| Invite tokens | Hashed at rest, compared on accept |
| Token lifetime | Expiry + single use |
| Email verification | **Required** before an invite can be claimed |
| Backfill hook | Fires on *verified session*, not user creation |
| Authorization | Server-side admin/owner check on every invite endpoint |
| Template rendering | All variables escaped |
| Abuse control | Database-backed rate limiting |
| Provider errors | Sanitised; logged server-side only |
| Trusted origins | Production URL only — **wildcard dropped** |
| Email sending | Never throws; a provider failure must not become a distinguishable response |

**The load-bearing decision was requiring email verification.** Without it, the backfill is an account-takeover primitive: `team.email` is set for a pending invitee while no `user` row exists, so registering that address *succeeds*, and the backfill grants the attacker the workspace. Hooking the backfill on the verified session closes it — an attacker can register but never reaches the state where the invite matches.

**No "invited by" in the UI** (§7.5) and **email escaping** are reconnaissance and injection defences, not cosmetic choices.

---

## 7. Security findings

### 7.1 Signup user enumeration — **FIXED in PR #9**

`user.email` was UNIQUE and the form rendered `USER_ALREADY_EXISTS` deliberately, giving an unauthenticated, unlimited, scriptable oracle over the whole user base — who uses the product, and by extension which studios and brands.

Two layers now close it:

1. **better-auth's built-in guard.** `requireEmailVerification: true` sets `shouldReturnGenericDuplicateResponse` (`sign-up.mjs:155`), which returns a synthetic user with `token: null` instead of `USER_ALREADY_EXISTS`. It also hashes the password on the duplicate path to equalise timing (line 200). This layer was **not** active before PR #9 — `autoSignIn` defaulted on and `requireEmailVerification` was false, so the real error was thrown.
2. **Our UI.** `SIGNUP_MESSAGE` is shown for every outcome and `serverMessage()` was deleted, so there is no branch on the lookup. This is defence in depth: the response stays non-committal even if the guard changes.

Plus `"/sign-up/email"` rate limit at 5/min.

### 7.2 Emails not normalised — **FIXED in PR #9**

Nothing lowercased or trimmed emails, and the UNIQUE index was case-sensitive. The failure was silent: admin invites `ada@studio.com`, user registers `Ada@studio.com` — a different string, so signup *succeeds*, the backfill `WHERE email = 'ada@studio.com'` matches zero rows, and they verify and land in the app **not in the workspace**, with no error shown.

Fixed with `normalizeEmail()` (trim + lowercase) in a `databaseHooks.user.create.before` hook, plus case-insensitive unique/index coverage on all three tables: `user`, `team`, `workspace_invites`.

Pre-flight duplicate check was run before migrating — no case-insensitive duplicates existed.

### 7.3 `createInvite` must scope its membership check — **still open**

- ✅ "Is this email already in **my** workspace?" — leaks only what the admin knows
- ❌ "Does a **user row** with this email exist?" — a workspace admin enumerates the whole product

Same endpoint, very different exposure. Write the scoped version deliberately, with a comment, so a future refactor doesn't globalise it.

### 7.4 Rate limits must be database-backed — **DONE in PR #9**

You're on Vercel serverless. In-memory counters are per-instance and reset on cold start, so they are bypassed by hitting a different instance. `rateLimit.storage: "database"` now stores counters in Postgres.

Key on **all three**: per-admin (one compromised account), per-workspace (colluding admins), per-recipient (stops using the form as a spam cannon aimed at one victim). The third is the one usually forgotten.

`"/send-verification-email"` is **not** yet covered by a `customRule` — only sign-up and sign-in are. Resend causes outbound mail, so it is a cost and spam-delivery vector. Add it when building the resend form.

### 7.5 Don't attribute invites in the UI — **still open**

If the workspace list renders "Invited by Priya", anyone who can verify an arbitrary address learns who invited them to which company — a targeted reconnaissance tool. Render invited workspaces identically to created ones.

### 7.6 Token entropy — **resolved, non-issue**

Invite token validity is observable (`invalid` / `expired` / `already accepted`), which is only exploitable if tokens are guessable. Use ≥32 bytes from a CSPRNG. Never use `workspace_invites.id` as the token — it's a UUID, and invite tokens must not be enumerable or short-lived-UUID-guessable.

The same reasoning settles better-auth's email tokens: HS256 JWTs signed with the secret, so they are high-entropy and unforgeable without it.

---

## 8. Known issues and tech debt

| Item | Impact |
|---|---|
| **Secrets exposed in transcript** | §5. Rotate `BETTER_AUTH_SECRET`, `RESEND_API_KEY`, Neon URL |
| **3 accounts locked out** | §5. `email_verified = false` + `requireEmailVerification` |
| **PR #9 unmerged** | `trustedOrigins`, verification, normalisation, rate limits, and migration `0008` are all unmerged |
| **`/verify-email` link lands on starter page** | §4. Cosmetic but confusing |
| `resendVerificationEmail` is dead code | §4. The only recovery path exists but is unreachable |
| `BETTER_AUTH_URL` is prod-only | §5. Set to localhost in the dev Doppler config, or local auth 403s |
| Stale dev servers on 3000/3001 | §9. They hold the port the client is pinned to |
| `gradient_end` column | Dead weight; the card only reads `gradient_start` |
| Tag colours | Derived from a label hash; **no user picker** exists yet |
| View Transitions | Only programmatic navigation animates; `<Link>` clicks (sidebar, breadcrumbs) don't |
| TanStack upgrade | `react-start@1.168.59` blocks all Vercel preview deploys (known XSS, CVE-2026-…). react-router must move in lockstep — it removed `createFileRoute`'s `server.handlers`, which broke the auth route |
| Browser support | View Transitions are Chrome/Edge 111+ only; graceful elsewhere |

---

## 9. Traps worth remembering

**Don't hand-write a better-auth schema.** The `rateLimit` table was written from the TypeScript type, which shows only `key`, `count`, `lastRequest`. The real Drizzle table has more, and the difference broke every auth request:

| | Written | Expected |
|---|---|---|
| Table name | `rateLimit` | `rate_limit` |
| `id` | missing | text **primary key** |
| `key` | primary key | `notNull().unique()` |
| `lastRequest` | `integer` | `bigint` |

Any deviation throws `SCHEMA_MISMATCH` at runtime. **Generate, then reconcile** — never infer from types.

**`npx @better-auth/cli generate` writes `./auth-schema.ts` into the repo root.** That is where the stray root-level `auth-schema.ts` came from — swept in by a `git add -A` and removed. Always pass `--output` to a scratch path, e.g. `--output ./scratch.ts --yes`, and delete it after. The CLI exits non-zero even on success.

**`drizzle-kit generate` prompts on table renames.** With no TTY it dies with "Interactive prompts require a TTY terminal". Workaround: `npx drizzle-kit generate --custom --name=<name>` emits an empty migration plus the snapshot, then hand-write the SQL. This is how `0008` was produced.

**`db:generate` needs DB credentials** even though it looks like an offline command — run it as `doppler run -- pnpm db:generate` or it stalls.

**Backticks in a PowerShell `git commit -m "..."` message get shell-interpreted** and the commit fails with a confusing "outside repository" error. Write the message to a file and use `git commit -F <path>`.

**`tsx` top-level `await` needs a `.mts` extension** — `.ts` compiles to CJS here and throws.

**Stale dev servers hold ports 3000/3001.** Two node processes from 2026-10-07 23:46 were still listening, so `pnpm dev` silently fell through to 3002 — while `VITE_BETTER_AUTH_URL` is pinned to `localhost:3000`. The browser then talks to a 10-hour-old server running pre-migration code and stale env, which looks exactly like your change being broken. Check with `Get-NetTCPConnection -State Listen | Where-Object LocalPort -eq 3000` before trusting any dev test.

**Postgres `"user"` is a reserved SQL keyword** — quote it in any raw SQL.

**Editor `edit` tool repeatedly failed on CRLF files** in this repo; `write` full-file or a node script was more reliable.

**Orphaned branch `feat/auth-origins-db-env`** (commit `aef719a`) contains `trustedOrigins` with `https://*.vercel.app`, which trusts *any* Vercel project. **Never merge it as-is.** PR #9 wrote trusted origins fresh.

**`document.startViewTransition` extracted to a variable and called detached loses the `Document` receiver** → `TypeError: Illegal invocation`. Inside a patched `router.history.push` that killed every navigation — login never redirected, `/dashboard` spun forever. Fixed in `695620d` by removing the history patch and wrapping only awaited call sites. Never patch `router.history`.

---

## 10. Verification habits

- **Secrets live in Doppler.** Run anything needing credentials as `doppler run -- <command>`. A plain shell has no `DATABASE_URL_UNPOOLED`.
- **Run migrations after pulling** any branch with schema changes, or queries fail on missing columns.
- **Verify against the live service, not by inference.** Both the `rate_limit` shape and the Resend domain status were wrong when guessed and only became obvious when actually called.
- **What I can verify:** typecheck, build, HTTP status codes, server logs, DB queries, provider API responses. **What I can't:** anything client-side or visual — routing behaviour, animation timing, permission edge cases in a browser. Say so rather than claiming a feature works.
- **Email delivery is now verified at the API level** (Resend `200`, real message id). Presentation in a real inbox is still unconfirmed — say so rather than claiming the email looks right.