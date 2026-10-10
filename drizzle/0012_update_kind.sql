-- Distinguishes a running comment from a progress update.
--
-- Both already live in `project_updates` and share one review flow, so this is
-- purely a labelling column rather than a new table. The default is `comment`,
-- which is how any post written before this column existed should read.

CREATE TYPE "public"."update_kind" AS ENUM('comment', 'progress_update');--> statement-breakpoint
ALTER TABLE "project_updates" ADD COLUMN "kind" "update_kind" DEFAULT 'comment' NOT NULL;