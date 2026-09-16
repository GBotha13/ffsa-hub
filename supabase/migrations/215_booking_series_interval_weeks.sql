-- Add interval_weeks to booking_series so series can repeat every N weeks,
-- not just every week. Existing rows (all weekly) default to 1.
ALTER TABLE public.booking_series
  ADD COLUMN interval_weeks smallint NOT NULL DEFAULT 1
    CHECK (interval_weeks BETWEEN 1 AND 52);
