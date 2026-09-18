CREATE TABLE "course_videos" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "google_drive_file_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" BIGINT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_videos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "course_videos_google_drive_file_id_key" ON "course_videos"("google_drive_file_id");

CREATE INDEX "course_videos_course_id_idx" ON "course_videos"("course_id");

ALTER TABLE "course_videos"
ADD CONSTRAINT "course_videos_course_id_fkey"
FOREIGN KEY ("course_id") REFERENCES "courses"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
