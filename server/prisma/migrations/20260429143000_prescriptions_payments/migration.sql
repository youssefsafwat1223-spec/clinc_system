DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentStatus') THEN
    CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID');
  END IF;
END $$;

ALTER TABLE "prescriptions" ADD COLUMN IF NOT EXISTS "appointment_id" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'prescriptions_appointment_id_fkey'
  ) THEN
    ALTER TABLE "prescriptions"
      ADD CONSTRAINT "prescriptions_appointment_id_fkey"
      FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "payments" (
  "id" TEXT NOT NULL,
  "appointment_id" TEXT NOT NULL,
  "patient_id" TEXT NOT NULL,
  "service_id" TEXT,
  "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "discount_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "final_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "paid_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
  "method" TEXT,
  "notes" TEXT,
  "paid_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "payments_appointment_id_key" ON "payments"("appointment_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_appointment_id_fkey'
  ) THEN
    ALTER TABLE "payments"
      ADD CONSTRAINT "payments_appointment_id_fkey"
      FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_patient_id_fkey'
  ) THEN
    ALTER TABLE "payments"
      ADD CONSTRAINT "payments_patient_id_fkey"
      FOREIGN KEY ("patient_id") REFERENCES "patients"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_service_id_fkey'
  ) THEN
    ALTER TABLE "payments"
      ADD CONSTRAINT "payments_service_id_fkey"
      FOREIGN KEY ("service_id") REFERENCES "services"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
