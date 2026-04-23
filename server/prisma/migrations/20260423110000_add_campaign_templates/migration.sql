CREATE TABLE "campaign_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'MARKETING',
    "language_code" TEXT NOT NULL DEFAULT 'ar',
    "header_type" TEXT NOT NULL DEFAULT 'NONE',
    "body_text" TEXT,
    "footer_text" TEXT,
    "image_url" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "campaign_templates_name_key" ON "campaign_templates"("name");
