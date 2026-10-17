CREATE TYPE "public"."vat_treatment" AS ENUM('standard', 'reverse_charge');--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "vat_treatment" "vat_treatment" DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "reverse_charge_vat_pence" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "vat_treatment" "vat_treatment" DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "variations" ADD COLUMN "vat_treatment" "vat_treatment" DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_reverse_charge_vat" CHECK ("invoices"."reverse_charge_vat_pence" >= 0 and ("invoices"."reverse_charge_vat_pence" = 0 or "invoices"."vat_pence" = 0));--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_reverse_charge_rate" CHECK ("quotes"."vat_treatment" = 'standard' or "quotes"."vat_rate_bps" > 0);;--> statement-breakpoint
-- ── The VAT treatment is part of what the client was sent: frozen with the rest (see 0009, 0010) ──
CREATE OR REPLACE FUNCTION variations_guard() RETURNS trigger
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
  IF (NEW.title, NEW.reason, NEW.lines, NEW.photos, NEW.vat_rate_bps, NEW.vat_treatment, NEW.net_pence, NEW.vat_pence, NEW.total_pence, NEW.snapshot, NEW.content_hash, NEW.sent_at, NEW.sent_by_member_id, NEW.created_by_member_id)
     IS DISTINCT FROM
     (OLD.title, OLD.reason, OLD.lines, OLD.photos, OLD.vat_rate_bps, OLD.vat_treatment, OLD.net_pence, OLD.vat_pence, OLD.total_pence, OLD.snapshot, OLD.content_hash, OLD.sent_at, OLD.sent_by_member_id, OLD.created_by_member_id) THEN
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
$$;
