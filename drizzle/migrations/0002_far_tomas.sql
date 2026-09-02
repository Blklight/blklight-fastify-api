CREATE TABLE "exercise_submissions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"exercise_id" text NOT NULL,
	"attempts" jsonb DEFAULT '[]' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "exercise_submissions_user_id_exercise_id_unique" UNIQUE("user_id","exercise_id")
);
--> statement-breakpoint
CREATE TABLE "tutorial_exercises" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"type" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exercise_submissions" ADD CONSTRAINT "exercise_submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_submissions" ADD CONSTRAINT "exercise_submissions_exercise_id_tutorial_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."tutorial_exercises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutorial_exercises" ADD CONSTRAINT "tutorial_exercises_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;