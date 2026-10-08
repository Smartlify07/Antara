-- Correct the rate limit table to better-auth's expected shape.
--
-- Migration 0007 created "rateLimit" (camelCase) with `key` as the primary
-- key and `lastRequest` as an integer. better-auth expects the table to be
-- named `rate_limit`, to carry an `id` primary key with `key` merely unique,
-- and to use bigint for `last_request`. The mismatch surfaced at runtime as
-- `SCHEMA_MISMATCH: Missing columns rateLimit.id`.
--
-- The table only ever holds disposable counters, so dropping it loses
-- nothing meaningful.

DROP TABLE IF EXISTS "rateLimit";
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);
