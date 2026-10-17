-- Unified comments (Increment 1, chunk 4).
--
-- The per-task `comments` table becomes the PRD's polymorphic Comment: one
-- table threaded onto tasks, requests, deliverables, and asset versions.
-- Rebuilding requires a rename dance because Postgres cannot create a table
-- while a table of the same name exists, and the data must survive the swap.
--
-- Workspace identity rides on the comment denormalized: a task's comment can
-- only belong to the workspace that owns its project, so the join through
-- tasks → projects is authoritative. The INNER JOINs make the migration fail
-- loudly (inserting nothing) on any orphaned row rather than silently moving
-- a comment without a workspace.
ALTER TABLE "comments" RENAME TO "comments_legacy";--> statement-breakpoint
CREATE TYPE "public"."comment_subject" AS ENUM('task', 'request', 'deliverable', 'version');--> statement-breakpoint
CREATE TABLE "comments" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"author_id" text,
	"subject_type" "comment_subject" NOT NULL,
	"subject_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
INSERT INTO "comments" ("id", "workspace_id", "author_id", "subject_type", "subject_id", "body", "created_at", "updated_at")
SELECT c."id", p."workspace_id", c."user_id", 'task', c."task_id", c."body", c."created_at", c."updated_at"
FROM "comments_legacy" c
INNER JOIN "tasks" t ON t."id" = c."task_id"
INNER JOIN "projects" p ON p."id" = t."project_id";--> statement-breakpoint
DROP TABLE "comments_legacy";--> statement-breakpoint
CREATE INDEX "comments_subject_idx" ON "comments" USING btree ("subject_type","subject_id","created_at");--> statement-breakpoint
CREATE INDEX "comments_author_idx" ON "comments" USING btree ("author_id")
