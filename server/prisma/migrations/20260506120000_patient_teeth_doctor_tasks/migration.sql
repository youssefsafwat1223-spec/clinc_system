ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "age" INTEGER;
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "gender" TEXT;
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "teeth_notes" JSONB NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS "doctor_services" (
  "id" TEXT NOT NULL,
  "doctor_id" TEXT NOT NULL,
  "service_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "doctor_services_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "doctor_services_doctor_id_service_id_key" ON "doctor_services"("doctor_id", "service_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'doctor_services_doctor_id_fkey'
  ) THEN
    ALTER TABLE "doctor_services"
      ADD CONSTRAINT "doctor_services_doctor_id_fkey"
      FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'doctor_services_service_id_fkey'
  ) THEN
    ALTER TABLE "doctor_services"
      ADD CONSTRAINT "doctor_services_service_id_fkey"
      FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
