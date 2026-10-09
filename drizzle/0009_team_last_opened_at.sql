-- Remember which workspace a person last had open, so the landing target is
-- server-authoritative and follows the account across devices rather than
-- living in one browser's localStorage.
--
-- NULL means "never opened", which is the normal state for a workspace whose
-- owner has just created it. Ordering therefore needs `nulls last`: Postgres
-- sorts nulls FIRST on `desc` by default, so without it a never-opened
-- workspace would outrank every genuinely visited one.
ALTER TABLE "team" ADD COLUMN "last_opened_at" timestamp;
--> statement-breakpoint
-- Resolving the landing workspace and listing the switcher both filter on
-- user_id alone. `team_workspace_user_unique` leads with workspace_id, so it
-- cannot serve either lookup.
CREATE INDEX "team_user_idx" ON "team" USING btree ("user_id");