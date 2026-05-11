ALTER TABLE "clinic_settings"
ADD COLUMN IF NOT EXISTS "location_image_url" TEXT,
ADD COLUMN IF NOT EXISTS "social_contact_prompt" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CallbackRequestStatus') THEN
    CREATE TYPE "CallbackRequestStatus" AS ENUM ('NEW', 'CONTACTED', 'CLOSED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "callback_requests" (
  "id" TEXT NOT NULL,
  "patient_id" TEXT,
  "platform" "Platform" NOT NULL,
  "sender_id" TEXT,
  "name" TEXT,
  "phone" TEXT NOT NULL,
  "request_message" TEXT,
  "source" TEXT NOT NULL DEFAULT 'MANYCHAT',
  "status" "CallbackRequestStatus" NOT NULL DEFAULT 'NEW',
  "notes" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "callback_requests_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'callback_requests_patient_id_fkey'
      AND table_name = 'callback_requests'
  ) THEN
    ALTER TABLE "callback_requests"
    ADD CONSTRAINT "callback_requests_patient_id_fkey"
    FOREIGN KEY ("patient_id") REFERENCES "patients"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "callback_requests_status_created_at_idx"
ON "callback_requests"("status", "created_at");

CREATE INDEX IF NOT EXISTS "callback_requests_phone_idx"
ON "callback_requests"("phone");
