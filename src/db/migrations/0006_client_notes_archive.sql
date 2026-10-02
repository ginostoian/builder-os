ALTER TABLE "clients" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_notes_len" CHECK (char_length("clients"."notes") between 0 and 2000);