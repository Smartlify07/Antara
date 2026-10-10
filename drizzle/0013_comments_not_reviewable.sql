-- Only progress updates are reviewed; a comment has no review lifecycle.
--
-- review_status becomes nullable so NULL can mean "not reviewable", which is
-- distinct from `pending` — "reviewable, not yet looked at". Leaving comments
-- at `pending` would imply a queue of approvals nobody works through.
--
-- The rows written so far are all comments (the progress-update kind landed in
-- 0012, after this branch's first migration), so they are cleared here rather
-- than left claiming to await a decision.

ALTER TABLE "project_updates" ALTER COLUMN "review_status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "project_updates" ALTER COLUMN "review_status" DROP NOT NULL;--> statement-breakpoint
UPDATE "project_updates" SET "review_status" = NULL WHERE "kind" = 'comment';