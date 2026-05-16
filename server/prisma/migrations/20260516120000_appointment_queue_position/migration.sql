ALTER TABLE "appointments"
ADD COLUMN IF NOT EXISTS "queue_position" INTEGER;

CREATE INDEX IF NOT EXISTS "appointments_queue_position_idx"
ON "appointments"("doctor_id", "appointment_type", "scheduled_time", "queue_position");
