CREATE TABLE IF NOT EXISTS "extra_charges" (
  "id" TEXT NOT NULL,
  "patient_id" TEXT NOT NULL,
  "service_id" TEXT,
  "doctor_id" TEXT,
  "description" TEXT,
  "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "paid_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'UNPAID',
  "method" TEXT,
  "notes" TEXT,
  "created_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "extra_charges_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'extra_charges_patient_id_fkey'
  ) THEN
    ALTER TABLE "extra_charges"
      ADD CONSTRAINT "extra_charges_patient_id_fkey"
      FOREIGN KEY ("patient_id") REFERENCES "patients"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'extra_charges_service_id_fkey'
  ) THEN
    ALTER TABLE "extra_charges"
      ADD CONSTRAINT "extra_charges_service_id_fkey"
      FOREIGN KEY ("service_id") REFERENCES "services"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'extra_charges_doctor_id_fkey'
  ) THEN
    ALTER TABLE "extra_charges"
      ADD CONSTRAINT "extra_charges_doctor_id_fkey"
      FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "extra_charges_patient_id_idx" ON "extra_charges"("patient_id");
CREATE INDEX IF NOT EXISTS "extra_charges_created_at_idx" ON "extra_charges"("created_at");
