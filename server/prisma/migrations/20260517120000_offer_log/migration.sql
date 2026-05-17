CREATE TABLE IF NOT EXISTS "offer_logs" (
  "id" TEXT NOT NULL,
  "patient_id" TEXT NOT NULL,
  "template_name" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "service_id" TEXT,
  "status" TEXT NOT NULL DEFAULT 'SENT',
  "message" TEXT,
  "sent_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "offer_logs_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'offer_logs_patient_id_fkey'
  ) THEN
    ALTER TABLE "offer_logs"
      ADD CONSTRAINT "offer_logs_patient_id_fkey"
      FOREIGN KEY ("patient_id") REFERENCES "patients"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "offer_logs_patient_id_idx" ON "offer_logs"("patient_id");
CREATE INDEX IF NOT EXISTS "offer_logs_template_name_idx" ON "offer_logs"("template_name");
CREATE INDEX IF NOT EXISTS "offer_logs_created_at_idx" ON "offer_logs"("created_at");
