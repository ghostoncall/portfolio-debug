-- Blog CMS migration (reconciles tables first created by hand during setup).
-- Idempotent: safe to run against the current database state.
CREATE TABLE IF NOT EXISTS "blog_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contact_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"message" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "media_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"size" integer NOT NULL,
	"storage_path" text,
	"width" integer,
	"height" integer,
	"alt" text,
	"caption" text,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "post_revisions" (
	"id" text PRIMARY KEY NOT NULL,
	"post_slug" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"content" jsonb NOT NULL,
	"revision_number" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "post_views" (
	"slug" text PRIMARY KEY NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"last_viewed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "needs_publish" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "search" "tsvector";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contact_messages_created_idx" ON "contact_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "post_revisions_slug_idx" ON "post_revisions" USING btree ("post_slug","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "posts_search_idx" ON "posts" USING gin ("search");
