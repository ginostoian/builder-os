CREATE TYPE "public"."notification_kind" AS ENUM('quote_opened', 'quote_comment', 'quote_accepted', 'quote_declined', 'variation_approved', 'variation_rejected', 'enquiry', 'lead_assigned', 'task_assigned', 'receipt_added', 'certificate_expiring');--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"kind" "notification_kind" NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"href" text NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_title_len" CHECK (char_length("notifications"."title") between 1 and 300),
	CONSTRAINT "notifications_body_len" CHECK (char_length("notifications"."body") between 1 and 600),
	CONSTRAINT "notifications_href_local" CHECK ("notifications"."href" like '/%' and "notifications"."href" not like '//%')
);
--> statement-breakpoint
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_member_fk" FOREIGN KEY ("org_id","member_id") REFERENCES "public"."members"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notifications_member_idx" ON "notifications" USING btree ("org_id","member_id","created_at");--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "notifications" AS PERMISSIVE FOR ALL TO "builderos_app" USING ("notifications"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid)) WITH CHECK ("notifications"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid));--> statement-breakpoint
ALTER TABLE "notifications" FORCE ROW LEVEL SECURITY;
