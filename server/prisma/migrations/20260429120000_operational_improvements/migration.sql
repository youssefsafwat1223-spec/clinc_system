ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "display_name" TEXT;
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "account_notes" TEXT;
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "account_balance" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "read_at" TIMESTAMP(3);
ALTER TABLE "clinic_settings" ADD COLUMN IF NOT EXISTS "brand_logo_url" TEXT;
ALTER TABLE "clinic_settings" ADD COLUMN IF NOT EXISTS "brand_primary_color" TEXT;
ALTER TABLE "clinic_settings" ADD COLUMN IF NOT EXISTS "brand_secondary_color" TEXT;
ALTER TABLE "clinic_settings" ADD COLUMN IF NOT EXISTS "prescription_footer" TEXT;

CREATE TABLE IF NOT EXISTS "patient_groups" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "patient_groups_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "patient_groups_name_key" ON "patient_groups"("name");

CREATE TABLE IF NOT EXISTS "patient_group_members" (
  "id" TEXT NOT NULL,
  "patient_id" TEXT NOT NULL,
  "group_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "patient_group_members_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "patient_group_members_patient_id_group_id_key" ON "patient_group_members"("patient_id", "group_id");

CREATE TABLE IF NOT EXISTS "discount_rules" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'PERCENT',
  "value" DOUBLE PRECISION NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "group_id" TEXT,
  "service_id" TEXT,
  "service_name" TEXT,
  "starts_at" TIMESTAMP(3),
  "ends_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "discount_rules_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "patient_group_members" ADD CONSTRAINT "patient_group_members_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "patient_group_members" ADD CONSTRAINT "patient_group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "patient_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "discount_rules" ADD CONSTRAINT "discount_rules_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "patient_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
