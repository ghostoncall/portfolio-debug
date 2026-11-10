CREATE TABLE "pages" (
	"slug" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"kind" text NOT NULL,
	"published" jsonb NOT NULL,
	"staged" jsonb NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"published_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"slug" text PRIMARY KEY NOT NULL,
	"published" jsonb NOT NULL,
	"staged" jsonb NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"published_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"slug" text PRIMARY KEY NOT NULL,
	"published" jsonb NOT NULL,
	"staged" jsonb NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"published_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" text PRIMARY KEY NOT NULL,
	"published" jsonb NOT NULL,
	"staged" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
