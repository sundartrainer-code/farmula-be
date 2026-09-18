ALTER TABLE "lessons"
  ADD COLUMN "slug" TEXT,
  ADD COLUMN "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "deleted_at" TIMESTAMP(3);

UPDATE "lessons"
SET "slug" = "id"
WHERE "slug" IS NULL;

ALTER TABLE "lessons"
  ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX "lessons_slug_key" ON "lessons"("slug");
CREATE UNIQUE INDEX "lessons_bunny_file_name_key" ON "lessons"("bunny_file_name");
