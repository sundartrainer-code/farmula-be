ALTER TABLE "lessons"
  ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lesson_number" INTEGER,
  ADD COLUMN "is_introduction" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "duration_formatted" TEXT,
  ADD COLUMN "published" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "lessons_course_id_sort_order_idx"
  ON "lessons"("course_id", "sort_order");
