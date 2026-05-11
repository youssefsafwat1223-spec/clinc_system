ALTER TABLE "patients"
ADD COLUMN IF NOT EXISTS "manychat_subscriber_id" TEXT,
ADD COLUMN IF NOT EXISTS "manychat_contact_id" TEXT;

CREATE INDEX IF NOT EXISTS "patients_manychat_subscriber_id_idx"
ON "patients"("manychat_subscriber_id");

CREATE INDEX IF NOT EXISTS "patients_manychat_contact_id_idx"
ON "patients"("manychat_contact_id");
