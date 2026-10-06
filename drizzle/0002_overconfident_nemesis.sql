CREATE TYPE "public"."project_status" AS ENUM('planning', 'active', 'on_hold', 'completed', 'archived');--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "status" "project_status" DEFAULT 'planning' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "deadline" timestamp;--> statement-breakpoint
CREATE INDEX "projects_workspace_status_idx" ON "projects" USING btree ("workspace_id","status") WHERE "projects"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "tasks_due_date_idx" ON "tasks" USING btree ("due_date") WHERE "tasks"."due_date" IS NOT NULL;