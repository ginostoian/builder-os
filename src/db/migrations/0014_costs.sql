CREATE TYPE "public"."expense_category" AS ENUM('materials', 'subcontractor', 'plant', 'waste', 'labour', 'other');--> statement-breakpoint
CREATE TYPE "public"."po_status" AS ENUM('draft', 'ordered', 'delivered', 'cancelled');--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"purchase_order_id" uuid,
	"category" "expense_category" DEFAULT 'materials' NOT NULL,
	"supplier" text,
	"description" text NOT NULL,
	"spent_on" date NOT NULL,
	"net_pence" integer NOT NULL,
	"vat_pence" integer DEFAULT 0 NOT NULL,
	"total_pence" integer NOT NULL,
	"receipts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rechargeable" boolean DEFAULT false NOT NULL,
	"recharge_markup_bps" integer DEFAULT 0 NOT NULL,
	"invoice_id" uuid,
	"recovered_on" date,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expenses_org_id_id_key" UNIQUE("org_id","id"),
	CONSTRAINT "expenses_supplier_len" CHECK (char_length("expenses"."supplier") between 1 and 200),
	CONSTRAINT "expenses_description_len" CHECK (char_length("expenses"."description") between 1 and 300),
	CONSTRAINT "expenses_total_range" CHECK ("expenses"."total_pence" between 0 and 1000000000),
	CONSTRAINT "expenses_amounts_add_up" CHECK ("expenses"."net_pence" + "expenses"."vat_pence" = "expenses"."total_pence" and "expenses"."net_pence" >= 0 and "expenses"."vat_pence" >= 0),
	CONSTRAINT "expenses_markup_range" CHECK ("expenses"."recharge_markup_bps" between 0 and 50000),
	CONSTRAINT "expenses_receipts_array" CHECK (jsonb_typeof("expenses"."receipts") = 'array' and jsonb_array_length("expenses"."receipts") <= 6),
	CONSTRAINT "expenses_billed_when_rechargeable" CHECK ("expenses"."rechargeable" or ("expenses"."invoice_id" is null and "expenses"."recovered_on" is null))
);
--> statement-breakpoint
ALTER TABLE "expenses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"project_id" uuid NOT NULL,
	"supplier_name" text NOT NULL,
	"supplier_email" text,
	"status" "po_status" DEFAULT 'draft' NOT NULL,
	"ordered_on" date,
	"needed_by" date,
	"delivery_notes" text,
	"lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"vat_rate_bps" integer DEFAULT 2000 NOT NULL,
	"net_pence" integer DEFAULT 0 NOT NULL,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_orders_org_id_id_key" UNIQUE("org_id","id"),
	CONSTRAINT "purchase_orders_org_number_key" UNIQUE("org_id","number"),
	CONSTRAINT "purchase_orders_number_positive" CHECK ("purchase_orders"."number" > 0),
	CONSTRAINT "purchase_orders_supplier_len" CHECK (char_length("purchase_orders"."supplier_name") between 1 and 200),
	CONSTRAINT "purchase_orders_supplier_email_len" CHECK (char_length("purchase_orders"."supplier_email") between 1 and 254),
	CONSTRAINT "purchase_orders_delivery_notes_len" CHECK (char_length("purchase_orders"."delivery_notes") between 1 and 2000),
	CONSTRAINT "purchase_orders_vat_range" CHECK ("purchase_orders"."vat_rate_bps" between 0 and 10000),
	CONSTRAINT "purchase_orders_net_range" CHECK ("purchase_orders"."net_pence" between 0 and 1000000000),
	CONSTRAINT "purchase_orders_lines_array" CHECK (jsonb_typeof("purchase_orders"."lines") = 'array' and jsonb_array_length("purchase_orders"."lines") <= 200),
	CONSTRAINT "purchase_orders_ordered_has_date" CHECK ("purchase_orders"."status" in ('draft', 'cancelled') or "purchase_orders"."ordered_on" is not null)
);
--> statement-breakpoint
ALTER TABLE "purchase_orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "site_visits" ADD COLUMN "day_rate_pence" integer;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_project_fk" FOREIGN KEY ("org_id","project_id") REFERENCES "public"."projects"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_po_fk" FOREIGN KEY ("org_id","purchase_order_id") REFERENCES "public"."purchase_orders"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_invoice_fk" FOREIGN KEY ("org_id","invoice_id") REFERENCES "public"."invoices"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_member_fk" FOREIGN KEY ("org_id","created_by_member_id") REFERENCES "public"."members"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_project_fk" FOREIGN KEY ("org_id","project_id") REFERENCES "public"."projects"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_member_fk" FOREIGN KEY ("org_id","created_by_member_id") REFERENCES "public"."members"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expenses_project_idx" ON "expenses" USING btree ("org_id","project_id","spent_on");--> statement-breakpoint
CREATE INDEX "expenses_po_idx" ON "expenses" USING btree ("org_id","purchase_order_id");--> statement-breakpoint
CREATE INDEX "purchase_orders_project_idx" ON "purchase_orders" USING btree ("org_id","project_id");--> statement-breakpoint
ALTER TABLE "site_visits" ADD CONSTRAINT "site_visits_day_rate" CHECK ("site_visits"."day_rate_pence" is null or "site_visits"."day_rate_pence" between 0 and 1000000000);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "expenses" AS PERMISSIVE FOR ALL TO "builderos_app" USING ("expenses"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid)) WITH CHECK ("expenses"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "purchase_orders" AS PERMISSIVE FOR ALL TO "builderos_app" USING ("purchase_orders"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid)) WITH CHECK ("purchase_orders"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid));--> statement-breakpoint
ALTER TABLE "purchase_orders" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "expenses" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
-- Past check-ins: cost them at the worker's current day rate (the best we know).
UPDATE "site_visits" v SET "day_rate_pence" = w."day_rate_pence" FROM "workers" w WHERE w."org_id" = v."org_id" AND w."id" = v."worker_id" AND w."day_rate_pence" IS NOT NULL;
