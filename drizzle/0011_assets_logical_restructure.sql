-- Restructure `assets` from a physical file into a logical file.
--
-- The old shape stored one row per upload, so a revised file either overwrote
-- its predecessor or created a second, unrelated row — there was nowhere to
-- record that v2 superseded v1, which is the confusion the PRD calls out in
-- section 3.
--
-- `assets` is now the named file with a version history; the bytes live on
-- `asset_versions` (created in 0010). The table has no rows in any
-- environment, so this is a straight drop-and-recreate rather than a
-- data-preserving migration.
--
-- The unique index is on (project_id, lower(filename)) so `Keynotes.pdf` and
-- `keynotes.pdf` resolve to one asset instead of two histories that could
-- never be compared against each other.

-- `asset_versions` (0010) holds a foreign key onto `assets`, so it has to be
-- detached before the table can be dropped. The guard is deliberate: on an
-- environment where 0010 has not been applied the constraint does not exist
-- and the migration should still succeed.
DO $$ BEGIN
	ALTER TABLE "asset_versions" DROP CONSTRAINT IF EXISTS "asset_versions_asset_id_assets_id_fk";
END $$;--> statement-breakpoint
DROP TABLE IF EXISTS "assets";--> statement-breakpoint
CREATE TABLE "assets" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"task_id" text,
	"filename" text NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
-- Separate statement because a table-level UNIQUE over an expression is not
-- valid inside CREATE TABLE; it has to be a standalone index.
CREATE UNIQUE INDEX "assets_project_filename_unique" ON "assets" USING btree ("project_id", lower("filename"));--> statement-breakpoint
CREATE INDEX "assets_project_idx" ON "assets" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "assets_task_idx" ON "assets" USING btree ("task_id");
DO $$ BEGIN
	ALTER TABLE "assets" ADD CONSTRAINT "assets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "assets" ADD CONSTRAINT "assets_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "assets" ADD CONSTRAINT "assets_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "asset_versions" ADD CONSTRAINT "asset_versions_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;