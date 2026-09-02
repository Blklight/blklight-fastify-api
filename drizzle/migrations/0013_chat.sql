CREATE TABLE "chat_channels" (
	"id" text PRIMARY KEY NOT NULL,
	"server_id" text NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'text' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"author_id" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"edited_at" timestamp,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "chat_server_members" (
	"id" text PRIMARY KEY NOT NULL,
	"server_id" text NOT NULL,
	"profile_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"invited_by" text,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"decided_at" timestamp,
	CONSTRAINT "chat_server_members_server_id_profile_id_unique" UNIQUE("server_id","profile_id")
);
--> statement-breakpoint
CREATE TABLE "chat_servers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"owner_id" text NOT NULL,
	"icon_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chat_servers_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "chat_channels" ADD CONSTRAINT "chat_channels_server_id_chat_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."chat_servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_channel_id_chat_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."chat_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_author_id_profiles_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_server_members" ADD CONSTRAINT "chat_server_members_server_id_chat_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."chat_servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_server_members" ADD CONSTRAINT "chat_server_members_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_server_members" ADD CONSTRAINT "chat_server_members_invited_by_profiles_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_servers" ADD CONSTRAINT "chat_servers_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_messages_channel_id_created_at_idx" ON "chat_messages" USING btree ("channel_id","created_at");