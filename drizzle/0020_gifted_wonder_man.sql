ALTER TABLE "project_updates" DROP CONSTRAINT "project_updates_reviewed_by_user_id_fk";
--> statement-breakpoint
ALTER TABLE "project_updates" DROP COLUMN "review_status";--> statement-breakpoint
ALTER TABLE "project_updates" DROP COLUMN "reviewed_by";--> statement-breakpoint
ALTER TABLE "project_updates" DROP COLUMN "reviewed_at";--> statement-breakpoint
ALTER TABLE "project_updates" DROP COLUMN "review_note";--> statement-breakpoint
DROP TYPE "public"."update_review_status";