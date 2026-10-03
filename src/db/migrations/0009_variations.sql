CREATE TYPE "public"."variation_status" AS ENUM('draft', 'sent', 'approved', 'rejected', 'withdrawn');--> statement-breakpoint
CREATE TABLE "variations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"title" text NOT NULL,
	"reason" text,
	"lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"vat_rate_bps" integer NOT NULL,
	"status" "variation_status" DEFAULT 'draft' NOT NULL,
	"net_pence" integer DEFAULT 0 NOT NULL,
	"vat_pence" integer DEFAULT 0 NOT NULL,
	"total_pence" integer DEFAULT 0 NOT NULL,
	"snapshot" jsonb,
	"content_hash" text,
	"sent_at" timestamp with time zone,
	"sent_by_member_id" uuid,
	"decided_at" timestamp with time zone,
	"decision_name" text,
	"signature" text,
	"decision_reason" text,
	"decision_ip" text,
	"decision_user_agent" text,
	"invoice_id" uuid,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "variations_org_id_id_key" UNIQUE("org_id","id"),
	CONSTRAINT "variations_quote_number_key" UNIQUE("org_id","quote_id","number"),
	CONSTRAINT "variations_number_positive" CHECK ("variations"."number" > 0),
	CONSTRAINT "variations_title_len" CHECK (char_length("variations"."title") between 1 and 200),
	CONSTRAINT "variations_reason_len" CHECK (char_length("variations"."reason") between 0 and 2000),
	CONSTRAINT "variations_vat_range" CHECK ("variations"."vat_rate_bps" between 0 and 10000),
	CONSTRAINT "variations_lines_array" CHECK (jsonb_typeof("variations"."lines") = 'array'),
	CONSTRAINT "variations_total_range" CHECK ("variations"."total_pence" between -1000000000 and 1000000000),
	CONSTRAINT "variations_amounts_add_up" CHECK ("variations"."net_pence" + "variations"."vat_pence" = "variations"."total_pence"),
	CONSTRAINT "variations_sent_frozen" CHECK ("variations"."status" = 'draft' or ("variations"."snapshot" is not null and "variations"."content_hash" ~ '^[0-9a-f]{64}$' and "variations"."sent_at" is not null)),
	CONSTRAINT "variations_decided" CHECK (("variations"."status" in ('approved', 'rejected')) = ("variations"."decided_at" is not null)),
	CONSTRAINT "variations_approved_signed" CHECK ("variations"."status" <> 'approved' or ("variations"."signature" is not null and "variations"."decision_name" is not null)),
	CONSTRAINT "variations_billed_when_approved" CHECK ("variations"."invoice_id" is null or "variations"."status" = 'approved'),
	CONSTRAINT "variations_decision_name_len" CHECK (char_length("variations"."decision_name") between 1 and 200),
	CONSTRAINT "variations_signature_len" CHECK (char_length("variations"."signature") between 1 and 200),
	CONSTRAINT "variations_decision_reason_len" CHECK (char_length("variations"."decision_reason") between 0 and 2000),
	CONSTRAINT "variations_decision_ip_len" CHECK (char_length("variations"."decision_ip") between 0 and 64),
	CONSTRAINT "variations_decision_user_agent_len" CHECK (char_length("variations"."decision_user_agent") between 0 and 500)
);
--> statement-breakpoint
ALTER TABLE "variations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "variations" ADD CONSTRAINT "variations_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variations" ADD CONSTRAINT "variations_quote_fk" FOREIGN KEY ("org_id","quote_id") REFERENCES "public"."quotes"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variations" ADD CONSTRAINT "variations_client_fk" FOREIGN KEY ("org_id","client_id") REFERENCES "public"."clients"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variations" ADD CONSTRAINT "variations_invoice_fk" FOREIGN KEY ("org_id","invoice_id") REFERENCES "public"."invoices"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variations" ADD CONSTRAINT "variations_sent_by_fk" FOREIGN KEY ("org_id","sent_by_member_id") REFERENCES "public"."members"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variations" ADD CONSTRAINT "variations_created_by_fk" FOREIGN KEY ("org_id","created_by_member_id") REFERENCES "public"."members"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "variations_quote_idx" ON "variations" USING btree ("org_id","quote_id");--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "variations" AS PERMISSIVE FOR ALL TO "builderos_app" USING ("variations"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid)) WITH CHECK ("variations"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid));--> statement-breakpoint
-- ── RLS applies to the owner too (see 0002) ──────────────────────────────────
ALTER TABLE "variations" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
-- ── A sent variation is a record ─────────────────────────────────────────────
-- Drafts change freely. Once sent, what the client was shown (lines, amounts, snapshot, hash) never changes;
-- only these moves are allowed: sent → approved / rejected (the client's decision, recorded once) or
-- withdrawn (by the team), and billing an approved one (invoice_id). Only drafts can be deleted.
CREATE FUNCTION variations_guard() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' THEN
      RAISE EXCEPTION 'only draft variations can be deleted' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;
  IF NEW.org_id IS DISTINCT FROM OLD.org_id OR NEW.quote_id IS DISTINCT FROM OLD.quote_id OR NEW.client_id IS DISTINCT FROM OLD.client_id OR NEW.number IS DISTINCT FROM OLD.number THEN
    RAISE EXCEPTION 'a variation cannot move' USING ERRCODE = '42501';
  END IF;
  IF OLD.status = 'draft' THEN
    IF NEW.status NOT IN ('draft', 'sent') THEN
      RAISE EXCEPTION 'a draft variation can only be sent' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  IF (NEW.title, NEW.reason, NEW.lines, NEW.vat_rate_bps, NEW.net_pence, NEW.vat_pence, NEW.total_pence, NEW.snapshot, NEW.content_hash, NEW.sent_at, NEW.sent_by_member_id, NEW.created_by_member_id)
     IS DISTINCT FROM
     (OLD.title, OLD.reason, OLD.lines, OLD.vat_rate_bps, OLD.net_pence, OLD.vat_pence, OLD.total_pence, OLD.snapshot, OLD.content_hash, OLD.sent_at, OLD.sent_by_member_id, OLD.created_by_member_id) THEN
    RAISE EXCEPTION 'a sent variation cannot be changed' USING ERRCODE = '42501';
  END IF;
  IF OLD.status = 'sent' THEN
    IF NEW.status NOT IN ('sent', 'approved', 'rejected', 'withdrawn') THEN
      RAISE EXCEPTION 'invalid variation status change' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  -- Decided or withdrawn: final. Only billing an approved variation may change.
  IF NEW.status IS DISTINCT FROM OLD.status
     OR (NEW.decided_at, NEW.decision_name, NEW.signature, NEW.decision_reason, NEW.decision_ip, NEW.decision_user_agent)
        IS DISTINCT FROM (OLD.decided_at, OLD.decision_name, OLD.signature, OLD.decision_reason, OLD.decision_ip, OLD.decision_user_agent) THEN
    RAISE EXCEPTION 'a decided variation is final' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$$;--> statement-breakpoint
CREATE TRIGGER variations_guard BEFORE UPDATE OR DELETE ON variations FOR EACH ROW EXECUTE FUNCTION variations_guard();
