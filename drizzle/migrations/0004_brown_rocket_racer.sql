CREATE TABLE "book_category" (
	"book_id" text PRIMARY KEY NOT NULL,
	"category_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "book_chapter_progress" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"chapter_id" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp,
	CONSTRAINT "book_chapter_progress_user_id_chapter_id_unique" UNIQUE("user_id","chapter_id")
);
--> statement-breakpoint
CREATE TABLE "book_chapters" (
	"id" text PRIMARY KEY NOT NULL,
	"book_id" text NOT NULL,
	"document_id" text NOT NULL,
	"position" integer NOT NULL,
	"intro_text" text,
	"outro_text" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "book_chapters_book_id_document_id_unique" UNIQUE("book_id","document_id"),
	CONSTRAINT "book_chapters_book_id_position_unique" UNIQUE("book_id","position")
);
--> statement-breakpoint
CREATE TABLE "book_progress" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"book_id" text NOT NULL,
	"last_chapter_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "book_progress_user_id_book_id_unique" UNIQUE("user_id","book_id")
);
--> statement-breakpoint
CREATE TABLE "book_tags" (
	"book_id" text NOT NULL,
	"tag_id" text NOT NULL,
	CONSTRAINT "book_tags_book_id_tag_id_unique" UNIQUE("book_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "books" (
	"id" text PRIMARY KEY NOT NULL,
	"author_id" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"cover_image_url" text,
	"slug" text NOT NULL,
	"toc" jsonb,
	"authorship" jsonb,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "books_author_id_slug_unique" UNIQUE("author_id","slug")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"parent_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "document_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"category_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "document_categories_document_id_unique" UNIQUE("document_id")
);
--> statement-breakpoint
CREATE TABLE "document_tags" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"tag_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "document_tags_document_id_tag_id_unique" UNIQUE("document_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tags_name_unique" UNIQUE("name"),
	CONSTRAINT "tags_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "book_category" ADD CONSTRAINT "book_category_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_category" ADD CONSTRAINT "book_category_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_chapter_progress" ADD CONSTRAINT "book_chapter_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_chapter_progress" ADD CONSTRAINT "book_chapter_progress_chapter_id_book_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."book_chapters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_chapters" ADD CONSTRAINT "book_chapters_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_chapters" ADD CONSTRAINT "book_chapters_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_progress" ADD CONSTRAINT "book_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_progress" ADD CONSTRAINT "book_progress_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_progress" ADD CONSTRAINT "book_progress_last_chapter_id_book_chapters_id_fk" FOREIGN KEY ("last_chapter_id") REFERENCES "public"."book_chapters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_tags" ADD CONSTRAINT "book_tags_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_tags" ADD CONSTRAINT "book_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_author_id_profiles_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;