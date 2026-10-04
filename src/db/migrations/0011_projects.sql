CREATE TYPE "public"."project_status" AS ENUM('booked', 'on_site', 'snagging', 'complete', 'on_hold');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('todo', 'in_progress', 'waiting', 'done');--> statement-breakpoint
CREATE TABLE "project_diary" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"entry_date" date NOT NULL,
	"body" text NOT NULL,
	"weather" text,
	"photos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"share_with_client" boolean DEFAULT false NOT NULL,
	"author_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_diary_body_len" CHECK (char_length("project_diary"."body") between 1 and 2000),
	CONSTRAINT "project_diary_weather" CHECK ("project_diary"."weather" is null or "project_diary"."weather" in ('dry', 'rain', 'wind', 'cold', 'hot')),
	CONSTRAINT "project_diary_photos_array" CHECK (jsonb_typeof("project_diary"."photos") = 'array' and jsonb_array_length("project_diary"."photos") <= 12)
);
--> statement-breakpoint
ALTER TABLE "project_diary" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "project_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"storage_key" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"share_with_client" boolean DEFAULT false NOT NULL,
	"uploaded_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_files_key" UNIQUE("org_id","storage_key"),
	CONSTRAINT "project_files_name_len" CHECK (char_length("project_files"."name") between 1 and 200),
	CONSTRAINT "project_files_size" CHECK ("project_files"."size_bytes" > 0)
);
--> statement-breakpoint
ALTER TABLE "project_files" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "project_phases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_phases_org_id_id_key" UNIQUE("org_id","id"),
	CONSTRAINT "project_phases_project_id_key" UNIQUE("org_id","project_id","id"),
	CONSTRAINT "project_phases_name_len" CHECK (char_length("project_phases"."name") between 1 and 200)
);
--> statement-breakpoint
ALTER TABLE "project_phases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "project_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"phase_id" uuid,
	"title" text NOT NULL,
	"notes" text,
	"status" "task_status" DEFAULT 'todo' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"assignee_member_id" uuid,
	"trade" text,
	"start_date" date,
	"due_date" date,
	"completed_at" timestamp with time zone,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_tasks_org_id_id_key" UNIQUE("org_id","id"),
	CONSTRAINT "project_tasks_title_len" CHECK (char_length("project_tasks"."title") between 1 and 300),
	CONSTRAINT "project_tasks_notes_len" CHECK (char_length("project_tasks"."notes") between 0 and 2000),
	CONSTRAINT "project_tasks_trade_len" CHECK (char_length("project_tasks"."trade") between 1 and 50),
	CONSTRAINT "project_tasks_dates_order" CHECK ("project_tasks"."due_date" is null or "project_tasks"."start_date" is null or "project_tasks"."due_date" >= "project_tasks"."start_date"),
	CONSTRAINT "project_tasks_done_has_time" CHECK (("project_tasks"."status" = 'done') = ("project_tasks"."completed_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "project_tasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"quote_id" uuid,
	"name" text NOT NULL,
	"site_address" jsonb,
	"status" "project_status" DEFAULT 'booked' NOT NULL,
	"start_date" date,
	"end_date" date,
	"manager_member_id" uuid,
	"share_progress" boolean DEFAULT true NOT NULL,
	"completed_at" timestamp with time zone,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_org_id_id_key" UNIQUE("org_id","id"),
	CONSTRAINT "projects_name_len" CHECK (char_length("projects"."name") between 1 and 200),
	CONSTRAINT "projects_dates_order" CHECK ("projects"."end_date" is null or "projects"."start_date" is null or "projects"."end_date" >= "projects"."start_date"),
	CONSTRAINT "projects_site_address_object" CHECK ("projects"."site_address" is null or jsonb_typeof("projects"."site_address") = 'object')
);
--> statement-breakpoint
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "project_diary" ADD CONSTRAINT "project_diary_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_diary" ADD CONSTRAINT "project_diary_project_fk" FOREIGN KEY ("org_id","project_id") REFERENCES "public"."projects"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_diary" ADD CONSTRAINT "project_diary_author_fk" FOREIGN KEY ("org_id","author_member_id") REFERENCES "public"."members"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_files" ADD CONSTRAINT "project_files_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_files" ADD CONSTRAINT "project_files_project_fk" FOREIGN KEY ("org_id","project_id") REFERENCES "public"."projects"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_files" ADD CONSTRAINT "project_files_uploaded_by_fk" FOREIGN KEY ("org_id","uploaded_by_member_id") REFERENCES "public"."members"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_phases" ADD CONSTRAINT "project_phases_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_phases" ADD CONSTRAINT "project_phases_project_fk" FOREIGN KEY ("org_id","project_id") REFERENCES "public"."projects"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_project_fk" FOREIGN KEY ("org_id","project_id") REFERENCES "public"."projects"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_phase_fk" FOREIGN KEY ("org_id","project_id","phase_id") REFERENCES "public"."project_phases"("org_id","project_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_assignee_fk" FOREIGN KEY ("org_id","assignee_member_id") REFERENCES "public"."members"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_created_by_fk" FOREIGN KEY ("org_id","created_by_member_id") REFERENCES "public"."members"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_fk" FOREIGN KEY ("org_id","client_id") REFERENCES "public"."clients"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_quote_fk" FOREIGN KEY ("org_id","quote_id") REFERENCES "public"."quotes"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_manager_fk" FOREIGN KEY ("org_id","manager_member_id") REFERENCES "public"."members"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_fk" FOREIGN KEY ("org_id","created_by_member_id") REFERENCES "public"."members"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_diary_project_idx" ON "project_diary" USING btree ("org_id","project_id","entry_date");--> statement-breakpoint
CREATE INDEX "project_files_project_idx" ON "project_files" USING btree ("org_id","project_id");--> statement-breakpoint
CREATE INDEX "project_tasks_project_idx" ON "project_tasks" USING btree ("org_id","project_id","status","position");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_one_per_quote" ON "projects" USING btree ("org_id","quote_id") WHERE "projects"."quote_id" is not null;--> statement-breakpoint
CREATE INDEX "projects_org_status_idx" ON "projects" USING btree ("org_id","status");--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "project_diary" AS PERMISSIVE FOR ALL TO "builderos_app" USING ("project_diary"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid)) WITH CHECK ("project_diary"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "project_files" AS PERMISSIVE FOR ALL TO "builderos_app" USING ("project_files"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid)) WITH CHECK ("project_files"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "project_phases" AS PERMISSIVE FOR ALL TO "builderos_app" USING ("project_phases"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid)) WITH CHECK ("project_phases"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "project_tasks" AS PERMISSIVE FOR ALL TO "builderos_app" USING ("project_tasks"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid)) WITH CHECK ("project_tasks"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "projects" AS PERMISSIVE FOR ALL TO "builderos_app" USING ("projects"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid)) WITH CHECK ("projects"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid));--> statement-breakpoint
-- ── RLS applies to the owner too (see 0002) ──────────────────────────────────
ALTER TABLE "projects" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "project_phases" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "project_tasks" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "project_diary" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "project_files" FORCE ROW LEVEL SECURITY;
