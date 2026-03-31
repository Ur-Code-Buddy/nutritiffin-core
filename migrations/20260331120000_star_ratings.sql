-- Replace binary review flags with 1–5 star ratings; drop denormalized food item vote counts.
-- When is_positive exists: map true → 5, false → 1, then drop is_positive.

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS stars smallint;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reviews' AND column_name = 'is_positive'
  ) THEN
    UPDATE reviews SET stars = CASE WHEN is_positive THEN 5 ELSE 1 END WHERE stars IS NULL;
    ALTER TABLE reviews DROP COLUMN is_positive;
  END IF;
END $$;

ALTER TABLE reviews ALTER COLUMN stars SET NOT NULL;

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE food_items DROP COLUMN IF EXISTS positive_count;
ALTER TABLE food_items DROP COLUMN IF EXISTS negative_count;
