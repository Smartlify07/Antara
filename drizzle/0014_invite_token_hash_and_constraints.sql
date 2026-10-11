-- Renamed, not dropped and re-added, so existing rows and their grants survive.
--
-- Invites store a SHA-256 hash, never the token. Naming the column for what it
-- is so nobody later assumes they can log it or compare it in the clear.
ALTER TABLE "workspace_invites" RENAME COLUMN "token" TO "token_hash";--> statement-breakpoint
-- The unique constraint follows the column name, so it is re-created under the
-- new name. Generated rather than hand-written, so it matches the snapshot.
ALTER TABLE "workspace_invites" DROP CONSTRAINT "workspace_invites_token_unique";--> statement-breakpoint
-- `team_user_or_email` was an OR while its comment claimed "exactly one". That
-- let a row carry both a user and an address, leaving the signup backfill with
-- no single identity to match on. num_nonnulls counts the non-null arguments,
-- so this enforces exactly one.
--
-- Safe to tighten: only the invite flow sets `email`, and it does not exist yet
-- at this point in the migration order, so every team row has user_id set and
-- email null.
ALTER TABLE "team" DROP CONSTRAINT "team_user_or_email";--> statement-breakpoint
-- One live invite per address per workspace.
--
-- Without this an admin can mint unlimited valid tokens for the same person,
-- each independently redeemable. It also makes resend a plain replace: drop the
-- pending row, insert a fresh one.
--
-- `lower(email)` so Ada@studio.com can't be invited twice as ada@studio.com.
CREATE UNIQUE INDEX "workspace_invites_pending_unique" ON "workspace_invites" USING btree ("workspace_id",lower("email")) WHERE "workspace_invites"."accepted_at" IS NULL;--> statement-breakpoint
ALTER TABLE "workspace_invites" ADD CONSTRAINT "workspace_invites_token_hash_unique" UNIQUE("token_hash");--> statement-breakpoint
ALTER TABLE "team" ADD CONSTRAINT "team_user_or_email" CHECK (num_nonnulls("team"."user_id", "team"."email") = 1);