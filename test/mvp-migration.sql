\set ON_ERROR_STOP on
-- Expanded by scripts/prepare-mvp-verification.cjs, then rolled back on exit.
BEGIN;
CREATE SCHEMA berohealth_mvp_verification;
SET LOCAL search_path = berohealth_mvp_verification, public;
CREATE TABLE users(id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE user_profiles(user_id uuid PRIMARY KEY REFERENCES users(id),
  current_weight_kg double precision, height_cm double precision, date_of_birth date,
  gender text, activity_level text, goal_type text, daily_kcal_target integer, daily_water_target integer);
CREATE TABLE user_settings(user_id uuid PRIMARY KEY REFERENCES users(id));
CREATE TABLE daily_nutritions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id), date date, total_kcal double precision DEFAULT 0,
  total_burned_kcal double precision DEFAULT 0, UNIQUE(user_id, date));
CREATE TABLE daily_logs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id), log_date date, water_consumed_ml integer DEFAULT 0,
  total_kcal_in integer DEFAULT 0, total_kcal_out integer DEFAULT 0,
  weight_log double precision, is_streak_day boolean DEFAULT false, UNIQUE(user_id, log_date));
CREATE TABLE meals(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), daily_nutrition_id uuid,
  meal_kcal double precision DEFAULT 0);
CREATE TABLE workouts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid,
  date date, burned_kcal double precision DEFAULT 0);
-- @MVP_MIGRATION@
-- @MVP_MIGRATION@

INSERT INTO users(id) VALUES ('00000000-0000-4000-8000-000000000001');
INSERT INTO user_profiles(user_id, current_weight_kg, height_cm, daily_water_target, tdee, daily_kcal_target)
VALUES ('00000000-0000-4000-8000-000000000001', 70, 170, 2000, 2200, 1700);
INSERT INTO daily_nutritions(id, user_id, date)
VALUES ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', current_date);
INSERT INTO daily_logs(user_id, log_date, total_kcal_in, total_kcal_out, water_consumed_ml)
VALUES ('00000000-0000-4000-8000-000000000001', current_date, 9999, 9999, 0);

DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM daily_logs WHERE total_kcal_in <> 0 OR total_kcal_out <> 0 OR is_streak_day)
    THEN RAISE EXCEPTION 'Canonical totals or empty-water streak failed'; END IF;
END $$;

INSERT INTO meals(daily_nutrition_id, meal_kcal)
VALUES ('00000000-0000-4000-8000-000000000002', 450.5), ('00000000-0000-4000-8000-000000000002', 300);
INSERT INTO workouts(user_id, date, burned_kcal)
VALUES ('00000000-0000-4000-8000-000000000001', current_date, 120.5);
UPDATE daily_nutritions SET total_kcal = 99999, total_burned_kcal = 99999;

DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM daily_logs WHERE total_kcal_in <> 750.5 OR total_kcal_out <> 120.5)
    THEN RAISE EXCEPTION 'Meal/workout totals must resist stale client values'; END IF;
END $$;

DELETE FROM meals WHERE meal_kcal = 300;
UPDATE daily_logs SET water_consumed_ml = 2000;
UPDATE user_profiles SET current_weight_kg = 69;
INSERT INTO daily_logs(user_id, log_date, water_consumed_ml, weight_log)
VALUES ('00000000-0000-4000-8000-000000000001', current_date - 5, 0, 75);

DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM daily_logs WHERE log_date = current_date AND total_kcal_in = 450.5 AND is_streak_day)
    THEN RAISE EXCEPTION 'Deleting meals or reaching the water goal failed'; END IF;
  IF (SELECT count(*) FROM health_measurements) <> 3 THEN RAISE EXCEPTION 'Profile and backdated weight history missing'; END IF;
  IF (SELECT current_weight_kg FROM user_profiles) <> 69 THEN RAISE EXCEPTION 'Backdated log overwrote current weight'; END IF;
END $$;

INSERT INTO legal_consents(user_id, version)
VALUES ('00000000-0000-4000-8000-000000000001', '2026-11-14') ON CONFLICT DO NOTHING;
INSERT INTO legal_consents(user_id, version)
VALUES ('00000000-0000-4000-8000-000000000001', '2026-11-14') ON CONFLICT DO NOTHING;
DO $$ BEGIN
  IF (SELECT count(*) FROM legal_consents) <> 1 THEN RAISE EXCEPTION 'Consent is not idempotent'; END IF;
END $$;
SELECT 'MVP migration assertions passed' AS result;
-- @STATS_QUERY@
ROLLBACK;
