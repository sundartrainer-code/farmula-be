ALTER TABLE "lessons"
ADD COLUMN "video_provider" TEXT NOT NULL DEFAULT 'google_drive',
ADD COLUMN "youtube_video_id" TEXT;

CREATE INDEX "lessons_video_provider_idx" ON "lessons"("video_provider");
