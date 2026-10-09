-- Invites store a SHA-256 hash, never the token. Renaming the column so the
-- name states that; with it called `token`, a future reader would reasonably
-- assume they can log it or compare it in the clear.
ALTER TABLE "workspace_invites" RENAME COLUMN "token" TO "token_hash";
--> statement-breakpoint
-- One live invite per address per workspace.
--
-- Without this an admin can mint unlimited valid tokens for the same person,
-- each independently redeemable. It also makes resend a plain replace: drop
-- the pending row, insert a fresh one.
--
-- `lower(email)` so Ada@studio.com can't be invited twice as ada@studio.com.
CREATE UNIQUE INDEX "workspace_invites_pending_unique"
  ON "workspace_invites" USING btree ("workspace_id", lower("email"))
  WHERE "accepted_at" IS NULL;
--> statement-breakpoint
-- `team_user_or_email` was an OR while its comment claimed "exactly one".
-- That let a row carry both a user and an address, leaving the signup
-- backfill with no single identity to match on. num_nonnulls counts the
-- non-null arguments, so this enforces exactly one.
--
-- Safe to tighten now: only the invite flow sets `email`, and it does not
-- exist yet, so every team row currently has user_id set and email null.
ALTER TABLE "team" DROP CONSTRAINT "team_user_or_email";
--> statement-breakpoint
ALTER TABLE "team" ADD CONSTRAINT "team_user_or_email"
  CHECK (num_nonnulls("user_id", "email") = 1);