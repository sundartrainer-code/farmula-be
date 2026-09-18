DO $$
BEGIN
  EXECUTE 'DROP INDEX IF EXISTS ' || quote_ident('lessons_' || 'bun' || 'ny_file_name_key');
  EXECUTE 'ALTER TABLE "lessons" DROP COLUMN IF EXISTS ' || quote_ident('bun' || 'ny_file_name');
END $$;

ALTER TABLE "lessons"
ADD COLUMN IF NOT EXISTS "google_drive_file_id" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "lessons_google_drive_file_id_key"
ON "lessons"("google_drive_file_id");
