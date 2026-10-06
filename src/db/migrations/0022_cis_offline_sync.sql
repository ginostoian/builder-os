CREATE TYPE "public"."cis_status" AS ENUM('gross', 'standard', 'higher');--> statement-breakpoint
CREATE TABLE "site_sync_ops" (
	"org_id" uuid NOT NULL,
	"id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"result_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "site_sync_ops_pkey" PRIMARY KEY("org_id","id")
);
--> statement-breakpoint
ALTER TABLE "site_sync_ops" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "worker_id" uuid;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "cis_materials_pence" integer;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "cis_rate_bps" integer;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "cis_deduction_pence" integer;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "cis_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "cis_contractor_utr" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "cis_employer_ref" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "cis_accounts_office_ref" text;--> statement-breakpoint
ALTER TABLE "site_visits" ADD COLUMN "recorded_offline" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "workers" ADD COLUMN "cis_status" "cis_status";--> statement-breakpoint
ALTER TABLE "workers" ADD COLUMN "utr" text;--> statement-breakpoint
ALTER TABLE "workers" ADD COLUMN "cis_verification_ref" text;--> statement-breakpoint
ALTER TABLE "workers" ADD COLUMN "cis_verified_on" date;--> statement-breakpoint
ALTER TABLE "site_sync_ops" ADD CONSTRAINT "site_sync_ops_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_sync_ops" ADD CONSTRAINT "site_sync_ops_member_fk" FOREIGN KEY ("org_id","member_id") REFERENCES "public"."members"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "site_sync_ops_created_idx" ON "site_sync_ops" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_worker_fk" FOREIGN KEY ("org_id","worker_id") REFERENCES "public"."workers"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expenses_worker_idx" ON "expenses" USING btree ("org_id","worker_id","spent_on");--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_cis_parts" CHECK (("expenses"."cis_rate_bps" is null and "expenses"."cis_deduction_pence" is null and "expenses"."cis_materials_pence" is null) or ("expenses"."worker_id" is not null and "expenses"."cis_rate_bps" in (0, 2000, 3000) and "expenses"."cis_materials_pence" between 0 and "expenses"."net_pence" and "expenses"."cis_deduction_pence" between 0 and "expenses"."net_pence"));--> statement-breakpoint
ALTER TABLE "workers" ADD CONSTRAINT "workers_utr_format" CHECK ("workers"."utr" is null or "workers"."utr" ~ '^[0-9]{10}$');--> statement-breakpoint
ALTER TABLE "workers" ADD CONSTRAINT "workers_cis_ref_format" CHECK ("workers"."cis_verification_ref" is null or "workers"."cis_verification_ref" ~ '^V[0-9]{10}(/?[A-Z]{1,2})?$');--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "site_sync_ops" AS PERMISSIVE FOR ALL TO "builderos_app" USING ("site_sync_ops"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid)) WITH CHECK ("site_sync_ops"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid));--> statement-breakpoint
ALTER TABLE "site_sync_ops" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT UPDATE (cis_enabled, cis_contractor_utr, cis_employer_ref, cis_accounts_office_ref) ON organizations TO builderos_app;
