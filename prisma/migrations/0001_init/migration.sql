CREATE TABLE IF NOT EXISTS "users" (
  "id" TEXT PRIMARY KEY,
  "firebase_uid" TEXT NOT NULL UNIQUE,
  "email" TEXT NOT NULL UNIQUE,
  "display_name" TEXT,
  "photo_url" TEXT,
  "role" TEXT NOT NULL DEFAULT 'student',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "subscription_plans" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "duration_months" INTEGER NOT NULL,
  "price" INTEGER NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS "subscriptions" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "plan_id" TEXT NOT NULL REFERENCES "subscription_plans"("id"),
  "status" TEXT NOT NULL DEFAULT 'active',
  "purchase_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "start_date" TIMESTAMP(3) NOT NULL,
  "expiry_date" TIMESTAMP(3) NOT NULL,
  "payment_provider" TEXT NOT NULL,
  "payment_id" TEXT NOT NULL,
  "amount_paid" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "payments" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "subscription_id" TEXT NOT NULL REFERENCES "subscriptions"("id") ON DELETE CASCADE,
  "transaction_id" TEXT NOT NULL,
  "payment_provider" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "status" TEXT NOT NULL DEFAULT 'paid',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payments_transaction_id_payment_provider_key" UNIQUE ("transaction_id", "payment_provider")
);

CREATE TABLE IF NOT EXISTS "courses" (
  "id" TEXT PRIMARY KEY,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "thumbnail" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "lessons" (
  "id" TEXT PRIMARY KEY,
  "course_id" TEXT NOT NULL REFERENCES "courses"("id") ON DELETE CASCADE,
  "title" TEXT NOT NULL,
  "bunny_file_name" TEXT NOT NULL,
  "duration" INTEGER NOT NULL DEFAULT 0,
  "thumbnail" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "progress" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "lesson_id" TEXT NOT NULL REFERENCES "lessons"("id") ON DELETE CASCADE,
  "current_time" INTEGER NOT NULL DEFAULT 0,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "progress_user_id_lesson_id_key" UNIQUE ("user_id", "lesson_id")
);

CREATE INDEX IF NOT EXISTS "subscriptions_user_id_idx" ON "subscriptions"("user_id");
CREATE INDEX IF NOT EXISTS "subscriptions_plan_id_idx" ON "subscriptions"("plan_id");
CREATE INDEX IF NOT EXISTS "payments_user_id_idx" ON "payments"("user_id");
CREATE INDEX IF NOT EXISTS "payments_subscription_id_idx" ON "payments"("subscription_id");
CREATE INDEX IF NOT EXISTS "lessons_course_id_idx" ON "lessons"("course_id");
CREATE INDEX IF NOT EXISTS "progress_lesson_id_idx" ON "progress"("lesson_id");
