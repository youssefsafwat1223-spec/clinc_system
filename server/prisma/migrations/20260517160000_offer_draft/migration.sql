CREATE TABLE IF NOT EXISTS "offer_drafts" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "template_name" TEXT NOT NULL,
  "body_text" TEXT,
  "image_url" TEXT,
  "service_id" TEXT,
  "channel" TEXT,
  "created_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "offer_drafts_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'offer_drafts_service_id_fkey'
  ) THEN
    ALTER TABLE "offer_drafts"
      ADD CONSTRAINT "offer_drafts_service_id_fkey"
      FOREIGN KEY ("service_id") REFERENCES "services"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "offer_drafts_template_name_idx" ON "offer_drafts"("template_name");
CREATE INDEX IF NOT EXISTS "offer_drafts_created_at_idx" ON "offer_drafts"("created_at");
