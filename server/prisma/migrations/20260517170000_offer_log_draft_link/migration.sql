ALTER TABLE "offer_logs"
ADD COLUMN IF NOT EXISTS "offer_draft_id" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'offer_logs_offer_draft_id_fkey'
  ) THEN
    ALTER TABLE "offer_logs"
      ADD CONSTRAINT "offer_logs_offer_draft_id_fkey"
      FOREIGN KEY ("offer_draft_id") REFERENCES "offer_drafts"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "offer_logs_offer_draft_id_idx" ON "offer_logs"("offer_draft_id");
