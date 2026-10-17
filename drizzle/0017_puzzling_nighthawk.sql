CREATE TYPE "public"."approval_decision" AS ENUM('approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."asset_version_source" AS ENUM('upload', 'external_link');--> statement-breakpoint
CREATE TYPE "public"."version_review_status" AS ENUM('submitted', 'approved', 'rejected', 'changes_requested', 'superseded');--> statement-breakpoint
CREATE TABLE "approvals" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"asset_version_id" text NOT NULL,
	"approver_id" text,
	"decision" "approval_decision" NOT NULL,
	"comment" text,
	"decided_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "asset_versions" ALTER COLUMN "provider" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "asset_versions" ALTER COLUMN "provider_key" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "asset_versions" ALTER COLUMN "mime_type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "asset_versions" ALTER COLUMN "size_bytes" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "asset_versions" ADD COLUMN "source" "asset_version_source" DEFAULT 'upload' NOT NULL;--> statement-breakpoint
ALTER TABLE "asset_versions" ADD COLUMN "external_provider" text;--> statement-breakpoint
ALTER TABLE "asset_versions" ADD COLUMN "external_file_id" text;--> statement-breakpoint
ALTER TABLE "asset_versions" ADD COLUMN "submitter_notes" text;--> statement-breakpoint
ALTER TABLE "asset_versions" ADD COLUMN "review_status" "version_review_status";--> statement-breakpoint
ALTER TABLE "asset_versions" ADD COLUMN "submitted_at" timestamp;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "deliverable_id" text;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "asset_type" text;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "tags" text[];--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_asset_version_id_asset_versions_id_fk" FOREIGN KEY ("asset_version_id") REFERENCES "public"."asset_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_approver_id_user_id_fk" FOREIGN KEY ("approver_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "approvals_version_idx" ON "approvals" USING btree ("asset_version_id","decided_at");--> statement-breakpoint
CREATE INDEX "approvals_workspace_idx" ON "approvals" USING btree ("workspace_id");--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_deliverable_id_deliverables_id_fk" FOREIGN KEY ("deliverable_id") REFERENCES "public"."deliverables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "asset_versions_review_submitted_idx" ON "asset_versions" USING btree ("review_status") WHERE review_status = 'submitted';--> statement-breakpoint
CREATE INDEX "assets_deliverable_idx" ON "assets" USING btree ("deliverable_id");--> statement-breakpoint
ALTER TABLE "asset_versions" ADD CONSTRAINT "asset_versions_review_has_submitted_at" CHECK ("asset_versions"."review_status" IS NULL OR "asset_versions"."submitted_at" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "asset_versions" ADD CONSTRAINT "asset_versions_source_provider_shape" CHECK (("asset_versions"."source" = 'upload' AND "asset_versions"."provider" IS NOT NULL AND "asset_versions"."provider_key" IS NOT NULL)
          OR ("asset_versions"."source" = 'external_link' AND "asset_versions"."provider" IS NULL AND "asset_versions"."provider_key" IS NULL));