ALTER TYPE "public"."notification_kind" ADD VALUE 'invoice_refunded';--> statement-breakpoint
ALTER TABLE "site_visits" ADD COLUMN "edited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "site_visits" ADD COLUMN "edited_by_member_id" uuid;--> statement-breakpoint
ALTER TABLE "site_visits" ADD CONSTRAINT "site_visits_editor_fk" FOREIGN KEY ("org_id","edited_by_member_id") REFERENCES "public"."members"("org_id","id") ON DELETE no action ON UPDATE no action;