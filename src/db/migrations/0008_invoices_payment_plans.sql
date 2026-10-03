CREATE TYPE "public"."invoice_status" AS ENUM('issued', 'paid', 'void');--> statement-breakpoint
CREATE TABLE "invoice_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_reminders_once" UNIQUE("org_id","invoice_id","kind"),
	CONSTRAINT "invoice_reminders_kind" CHECK ("invoice_reminders"."kind" in ('before', 'due', 'overdue_3', 'overdue_7'))
);
--> statement-breakpoint
ALTER TABLE "invoice_reminders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"client_id" uuid NOT NULL,
	"quote_id" uuid,
	"stage_id" uuid,
	"status" "invoice_status" DEFAULT 'issued' NOT NULL,
	"issue_date" date NOT NULL,
	"due_date" date NOT NULL,
	"net_pence" integer NOT NULL,
	"vat_pence" integer NOT NULL,
	"total_pence" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"paid_on" date,
	"paid_reference" text,
	"sent_at" timestamp with time zone,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_org_id_id_key" UNIQUE("org_id","id"),
	CONSTRAINT "invoices_org_number_key" UNIQUE("org_id","number"),
	CONSTRAINT "invoices_number_positive" CHECK ("invoices"."number" > 0),
	CONSTRAINT "invoices_total_range" CHECK ("invoices"."total_pence" between 0 and 1000000000),
	CONSTRAINT "invoices_amounts_add_up" CHECK ("invoices"."net_pence" + "invoices"."vat_pence" = "invoices"."total_pence" and "invoices"."net_pence" >= 0 and "invoices"."vat_pence" >= 0),
	CONSTRAINT "invoices_due_after_issue" CHECK ("invoices"."due_date" >= "invoices"."issue_date"),
	CONSTRAINT "invoices_paid_has_date" CHECK (("invoices"."status" = 'paid') = ("invoices"."paid_on" is not null)),
	CONSTRAINT "invoices_snapshot_object" CHECK (jsonb_typeof("invoices"."snapshot") = 'object'),
	CONSTRAINT "invoices_paid_reference_len" CHECK (char_length("invoices"."paid_reference") between 0 and 50)
);
--> statement-breakpoint
ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "bank_account_name" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "bank_sort_code" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "bank_account_number" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "payment_terms_days" integer DEFAULT 14 NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "reminders_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "payment_plan" jsonb;--> statement-breakpoint
ALTER TABLE "invoice_reminders" ADD CONSTRAINT "invoice_reminders_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_reminders" ADD CONSTRAINT "invoice_reminders_invoice_fk" FOREIGN KEY ("org_id","invoice_id") REFERENCES "public"."invoices"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_fk" FOREIGN KEY ("org_id","client_id") REFERENCES "public"."clients"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_quote_fk" FOREIGN KEY ("org_id","quote_id") REFERENCES "public"."quotes"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_member_fk" FOREIGN KEY ("org_id","created_by_member_id") REFERENCES "public"."members"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_one_per_stage" ON "invoices" USING btree ("org_id","quote_id","stage_id") WHERE "invoices"."status" <> 'void' and "invoices"."stage_id" is not null;--> statement-breakpoint
CREATE INDEX "invoices_org_status_due_idx" ON "invoices" USING btree ("org_id","status","due_date");--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_bank_account_name_len" CHECK (char_length("organizations"."bank_account_name") between 1 and 200);--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_bank_sort_code_format" CHECK ("organizations"."bank_sort_code" is null or "organizations"."bank_sort_code" ~ '^[0-9]{6}$');--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_bank_account_number_format" CHECK ("organizations"."bank_account_number" is null or "organizations"."bank_account_number" ~ '^[0-9]{8}$');--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_payment_terms_range" CHECK ("organizations"."payment_terms_days" between 0 and 120);--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_payment_plan_array" CHECK ("quotes"."payment_plan" is null or jsonb_typeof("quotes"."payment_plan") = 'array');--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "invoice_reminders" AS PERMISSIVE FOR ALL TO "builderos_app" USING ("invoice_reminders"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid)) WITH CHECK ("invoice_reminders"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "invoices" AS PERMISSIVE FOR ALL TO "builderos_app" USING ("invoices"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid)) WITH CHECK ("invoices"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "reminder_lookup" ON "invoices" AS PERMISSIVE FOR SELECT TO "builderos_lookup" USING (true);--> statement-breakpoint
-- ── RLS applies to the owner too (see 0002) ──────────────────────────────────
ALTER TABLE "invoices" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "invoice_reminders" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
-- ── Company payment settings: the app may edit them (column grants from 0005) ──
GRANT UPDATE (bank_account_name, bank_sort_code, bank_account_number, payment_terms_days, reminders_enabled) ON organizations TO builderos_app;--> statement-breakpoint
-- ── Invoices are records ─────────────────────────────────────────────────────
-- Never deleted (void instead), and once raised only the payment status can change: amounts, dates,
-- bank details and wording stay exactly as issued.
REVOKE UPDATE, DELETE ON invoices FROM builderos_app;--> statement-breakpoint
GRANT UPDATE (status, paid_on, paid_reference, sent_at, updated_at) ON invoices TO builderos_app;--> statement-breakpoint
REVOKE UPDATE, DELETE ON invoice_reminders FROM builderos_app;--> statement-breakpoint
-- ── Reminder run lookup ──────────────────────────────────────────────────────
-- The daily reminder job has no session. This tells it which companies have unpaid invoices due by a date
-- (with reminders switched on), and nothing else; the work itself then runs inside each company's tenant.
GRANT SELECT (org_id, status, due_date) ON invoices TO builderos_lookup;--> statement-breakpoint
GRANT SELECT (reminders_enabled) ON organizations TO builderos_lookup;--> statement-breakpoint
CREATE FUNCTION app_orgs_with_due_invoices(p_until date)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT DISTINCT i.org_id FROM public.invoices i JOIN public.organizations o ON o.id = i.org_id
  WHERE i.status = 'issued' AND i.due_date <= p_until AND o.reminders_enabled AND o.deleted_at IS NULL
$$;--> statement-breakpoint
GRANT CREATE ON SCHEMA public TO builderos_lookup;--> statement-breakpoint
ALTER FUNCTION app_orgs_with_due_invoices(date) OWNER TO builderos_lookup;--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM builderos_lookup;--> statement-breakpoint
REVOKE ALL ON FUNCTION app_orgs_with_due_invoices(date) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_orgs_with_due_invoices(date) TO builderos_app;
