CREATE TABLE "highlight_palette" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"colors" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "highlight_palette_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "highlights" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"document_id" text NOT NULL,
	"selection" jsonb NOT NULL,
	"annotation" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "highlight_palette" ADD CONSTRAINT "highlight_palette_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "highlights" ADD CONSTRAINT "highlights_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "highlights" ADD CONSTRAINT "highlights_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;