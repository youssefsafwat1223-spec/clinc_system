ALTER TYPE "AppointmentStatus" ADD VALUE IF NOT EXISTS 'NO_SHOW';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AppointmentType') THEN
    CREATE TYPE "AppointmentType" AS ENUM ('SCHEDULED', 'WALK_IN');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PatientProfileType') THEN
    CREATE TYPE "PatientProfileType" AS ENUM ('LEAD', 'BOOKED');
  END IF;
END $$;

ALTER TABLE "patients"
ADD COLUMN IF NOT EXISTS "profile_type" "PatientProfileType" NOT NULL DEFAULT 'LEAD';

ALTER TABLE "appointments"
ADD COLUMN IF NOT EXISTS "appointment_type" "AppointmentType" NOT NULL DEFAULT 'SCHEDULED';

DROP INDEX IF EXISTS "patients_phone_key";

CREATE INDEX IF NOT EXISTS "patients_phone_idx"
ON "patients"("phone");

CREATE INDEX IF NOT EXISTS "patients_profile_type_idx"
ON "patients"("profile_type");
