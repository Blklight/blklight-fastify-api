CREATE TABLE "document_style_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"author_id" text NOT NULL,
	"name" text NOT NULL,
	"document_type" text,
	"typography" text NOT NULL,
	"paper_style" jsonb,
	"paper_texture" jsonb,
	"document_header" jsonb,
	"document_footer" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_styles" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"typography" text DEFAULT 'sans' NOT NULL,
	"paper_style" jsonb,
	"paper_texture" jsonb,
	"cover_settings" jsonb,
	"document_header" jsonb,
	"document_footer" jsonb,
	"document_signature" jsonb,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "document_styles_document_id_unique" UNIQUE("document_id")
);
--> statement-breakpoint
CREATE TABLE "document_types" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "document_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
INSERT INTO "document_types" ("id", "name", "created_at") VALUES
	(gen_random_uuid()::text, 'article', now()),
	(gen_random_uuid()::text, 'tutorial', now()),
	(gen_random_uuid()::text, 'contract', now()),
	(gen_random_uuid()::text, 'project', now()),
	(gen_random_uuid()::text, 'note', now());
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"author_id" text NOT NULL,
	"type_id" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"title" text NOT NULL,
	"abstract" text,
	"content" jsonb,
	"cover_image_url" text,
	"slug" text NOT NULL,
	"authorship" jsonb,
	"published_at" timestamp,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "documents_author_id_slug_unique" UNIQUE("author_id","slug")
);
--> statement-breakpoint
CREATE TABLE "signatures" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"user_hash" text NOT NULL,
	"secret_encrypted" text NOT NULL,
	"tx_hash" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "signatures_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "signatures_user_hash_unique" UNIQUE("user_hash")
);
--> statement-breakpoint
ALTER TABLE "document_style_templates" ADD CONSTRAINT "document_style_templates_author_id_profiles_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_styles" ADD CONSTRAINT "document_styles_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_author_id_profiles_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_type_id_document_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."document_types"("id") ON DELETE no action ON UPDATE no action;