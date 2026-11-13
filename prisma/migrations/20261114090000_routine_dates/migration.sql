-- Routines run on picked weekdays between a start and an optional end date; the school-day /
-- holiday split is no longer used. day_type is kept (defaulting to 'any') so the app version
-- still running keeps working during the deploy; it can be dropped later.
ALTER TABLE "routine_items"
  ADD COLUMN "start_date" DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN "end_date" DATE,
  ALTER COLUMN "day_type" SET DEFAULT 'any';

-- Existing routines start on the (Singapore) day they were added.
UPDATE "routine_items"
  SET "start_date" = ("created_at" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Singapore')::date;
