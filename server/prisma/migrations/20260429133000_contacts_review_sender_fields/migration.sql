ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "display_name" TEXT;

ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "accounting_notes" TEXT;
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "total_spent" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "last_payment_date" TIMESTAMP(3);
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "credit_balance" DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "reviewed_by" TEXT;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "reviewed_at" TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'messages_reviewed_by_fkey'
  ) THEN
    ALTER TABLE "messages"
      ADD CONSTRAINT "messages_reviewed_by_fkey"
      FOREIGN KEY ("reviewed_by") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "clinic_settings" ADD COLUMN IF NOT EXISTS "bot_name" TEXT;
ALTER TABLE "clinic_settings" ADD COLUMN IF NOT EXISTS "logo_url" TEXT;

CREATE TABLE IF NOT EXISTS "direct_contacts" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "description" TEXT,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "direct_contacts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "direct_contacts_phone_key" ON "direct_contacts"("phone");
