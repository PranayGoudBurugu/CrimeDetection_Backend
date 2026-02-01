-- CreateTable
CREATE TABLE "analyses" (
    "id" SERIAL NOT NULL,
    "video_filename" VARCHAR(500) NOT NULL,
    "video_path" VARCHAR(1000) NOT NULL,
    "file_size" BIGINT,
    "mime_type" VARCHAR(100),
    "duration" INTEGER,
    "model_type" VARCHAR(50) NOT NULL DEFAULT 'gemini',
    "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "ml_response" JSONB,
    "error_message" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(6),

    CONSTRAINT "analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "default_model" VARCHAR(50) NOT NULL DEFAULT 'gemini',
    "gemini_api_key" TEXT,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_analyses_status" ON "analyses"("status");

-- CreateIndex
CREATE INDEX "idx_analyses_created_at" ON "analyses"("created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_analyses_video_filename" ON "analyses"("video_filename");

-- CreateIndex
CREATE INDEX "idx_analyses_model_type" ON "analyses"("model_type");
