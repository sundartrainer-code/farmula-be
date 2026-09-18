WITH ranked_active AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "user_id"
      ORDER BY "expiry_date" DESC, "created_at" DESC
    ) AS active_rank
  FROM "subscriptions"
  WHERE "status" IN ('active', 'ACTIVE')
)
UPDATE "subscriptions" AS subscription
SET "status" = 'REPLACED'
FROM ranked_active
WHERE subscription."id" = ranked_active."id"
  AND ranked_active.active_rank > 1;

CREATE UNIQUE INDEX "subscriptions_one_active_per_user"
  ON "subscriptions"("user_id")
  WHERE "status" IN ('active', 'ACTIVE');
