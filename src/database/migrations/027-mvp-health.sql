BEGIN;
-- Re-running DDL in verification must not accumulate snapshots or triggers.
DROP TRIGGER IF EXISTS canonical_nutrition_totals ON daily_nutritions;
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version integer NOT NULL DEFAULT 0;
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS blood_type varchar(8),
  ADD COLUMN IF NOT EXISTS occupation text,
  ADD COLUMN IF NOT EXISTS activity_habits text,
  ADD COLUMN IF NOT EXISTS medical_conditions text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS hydration_restricted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS enabled_modules text[] NOT NULL DEFAULT '{nutrition,water,workout}',
  ADD COLUMN IF NOT EXISTS bmr_formula varchar NOT NULL DEFAULT 'MIFFLIN_ST_JEOR',
  ADD COLUMN IF NOT EXISTS bmr integer,
  ADD COLUMN IF NOT EXISTS tdee integer;

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS show_water boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_calories boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_workout boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS water_start_time varchar(5) NOT NULL DEFAULT '11:00',
  ADD COLUMN IF NOT EXISTS water_end_time varchar(5) NOT NULL DEFAULT '20:30';

CREATE TABLE IF NOT EXISTS health_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  measured_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,
  source varchar(10) NOT NULL DEFAULT 'PROFILE',
  weight_kg double precision,
  height_cm double precision,
  bmi double precision,
  bmr integer,
  tdee integer,
  kcal_target integer,
  water_target integer
);
CREATE INDEX IF NOT EXISTS health_measurements_user_date ON health_measurements(user_id, measured_date, recorded_at);

CREATE OR REPLACE FUNCTION capture_health_measurement() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND
    ROW(NEW.current_weight_kg, NEW.height_cm, NEW.date_of_birth, NEW.gender,
        NEW.activity_level, NEW.goal_type, NEW.bmr_formula, NEW.hydration_restricted)
    IS NOT DISTINCT FROM
    ROW(OLD.current_weight_kg, OLD.height_cm, OLD.date_of_birth, OLD.gender,
        OLD.activity_level, OLD.goal_type, OLD.bmr_formula, OLD.hydration_restricted)
    THEN RETURN NEW;
  END IF;
  INSERT INTO health_measurements(user_id, weight_kg, height_cm, bmi, bmr, tdee, kcal_target, water_target)
  VALUES (NEW.user_id, NEW.current_weight_kg, NEW.height_cm,
    CASE WHEN NEW.height_cm > 0 AND NEW.current_weight_kg > 0
      THEN round((NEW.current_weight_kg / power(NEW.height_cm / 100.0, 2))::numeric, 1) END,
    NEW.bmr, NEW.tdee, NEW.daily_kcal_target, NEW.daily_water_target);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS health_measurement_snapshot ON user_profiles;
CREATE TRIGGER health_measurement_snapshot AFTER INSERT OR UPDATE ON user_profiles
FOR EACH ROW EXECUTE FUNCTION capture_health_measurement();

-- Existing values are a baseline at migration time, never fabricated past history.
INSERT INTO health_measurements(user_id, weight_kg, height_cm, bmi, bmr, tdee, kcal_target, water_target)
SELECT p.user_id, p.current_weight_kg, p.height_cm,
 CASE WHEN p.height_cm > 0 AND p.current_weight_kg > 0
 THEN round((p.current_weight_kg / power(p.height_cm / 100.0, 2))::numeric, 1) END,
 p.bmr, p.tdee, p.daily_kcal_target, p.daily_water_target
FROM user_profiles p WHERE NOT EXISTS (SELECT 1 FROM health_measurements h WHERE h.user_id = p.user_id);

ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS water_target_ml integer;
ALTER TABLE daily_logs ALTER COLUMN total_kcal_in TYPE double precision;
ALTER TABLE daily_logs ALTER COLUMN total_kcal_out TYPE double precision;

CREATE OR REPLACE FUNCTION refresh_current_water_target() RETURNS trigger AS $$
BEGIN
  UPDATE daily_logs SET water_target_ml = NEW.daily_water_target
    WHERE user_id = NEW.user_id AND log_date = (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS current_water_target ON user_profiles;
CREATE TRIGGER current_water_target AFTER UPDATE OF daily_water_target ON user_profiles
FOR EACH ROW EXECUTE FUNCTION refresh_current_water_target();

CREATE TABLE IF NOT EXISTS water_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_date date NOT NULL,
  beverage_type varchar(20) NOT NULL,
  volume_ml integer NOT NULL CHECK (volume_ml > 0 AND volume_ml <= 10000),
  hydration_factor double precision NOT NULL CHECK (hydration_factor >= 0 AND hydration_factor <= 1),
  effective_ml integer NOT NULL CHECK (effective_ml >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS water_entries_user_date ON water_entries(user_id, log_date);

CREATE TABLE IF NOT EXISTS legal_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  version varchar(40) NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, version)
);

CREATE TABLE IF NOT EXISTS automatic_reminder_deliveries (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delivery_key varchar(100) NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id, delivery_key)
);

-- Tracking calories are compatibility fields; nutrition is the source of truth.
CREATE OR REPLACE FUNCTION canonical_tracking_values() RETURNS trigger AS $$
DECLARE current_target integer;
BEGIN
  SELECT total_kcal, total_burned_kcal INTO NEW.total_kcal_in, NEW.total_kcal_out
    FROM daily_nutritions WHERE user_id = NEW.user_id AND date = NEW.log_date;
  NEW.total_kcal_in := COALESCE(NEW.total_kcal_in, 0);
  NEW.total_kcal_out := COALESCE(NEW.total_kcal_out, 0);
  IF NEW.log_date = (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date THEN
    SELECT daily_water_target INTO current_target FROM user_profiles WHERE user_id = NEW.user_id;
  ELSE
    SELECT water_target INTO current_target FROM health_measurements
      WHERE user_id = NEW.user_id AND source = 'PROFILE' AND measured_date <= NEW.log_date
      ORDER BY measured_date DESC, recorded_at DESC LIMIT 1;
  END IF;
  NEW.water_target_ml := COALESCE(NEW.water_target_ml, current_target);
  NEW.is_streak_day := NEW.water_target_ml > 0 AND NEW.water_consumed_ml >= NEW.water_target_ml;
  NEW.is_streak_day := COALESCE(NEW.is_streak_day, false);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS canonical_tracking ON daily_logs;
CREATE TRIGGER canonical_tracking BEFORE INSERT OR UPDATE ON daily_logs
FOR EACH ROW EXECUTE FUNCTION canonical_tracking_values();

CREATE OR REPLACE FUNCTION sync_tracking_calories() RETURNS trigger AS $$
BEGIN
  UPDATE daily_logs SET total_kcal_in = NEW.total_kcal, total_kcal_out = NEW.total_burned_kcal
    WHERE user_id = NEW.user_id AND log_date = NEW.date;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS sync_tracking_calories ON daily_nutritions;
CREATE TRIGGER sync_tracking_calories AFTER INSERT OR UPDATE ON daily_nutritions
FOR EACH ROW EXECUTE FUNCTION sync_tracking_calories();
UPDATE daily_logs SET is_streak_day = false;

CREATE OR REPLACE FUNCTION capture_logged_weight() RETURNS trigger AS $$
DECLARE p user_profiles%ROWTYPE;
BEGIN
  IF NEW.weight_log IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.weight_log IS NOT DISTINCT FROM OLD.weight_log THEN RETURN NEW; END IF;
  SELECT * INTO p FROM user_profiles WHERE user_id = NEW.user_id;
  INSERT INTO health_measurements(user_id, measured_date, source, weight_kg, height_cm, bmi,
    bmr, tdee, kcal_target, water_target)
  VALUES (NEW.user_id, NEW.log_date, 'WEIGHT', NEW.weight_log, p.height_cm,
    CASE WHEN p.height_cm > 0 THEN round((NEW.weight_log / power(p.height_cm / 100.0, 2))::numeric, 1) END,
    CASE WHEN NEW.log_date = (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date THEN p.bmr END,
    CASE WHEN NEW.log_date = (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date THEN p.tdee END,
    CASE WHEN NEW.log_date = (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date THEN p.daily_kcal_target END,
    NEW.water_target_ml);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS logged_weight_snapshot ON daily_logs;
CREATE TRIGGER logged_weight_snapshot AFTER INSERT OR UPDATE ON daily_logs
FOR EACH ROW EXECUTE FUNCTION capture_logged_weight();

-- Derive totals from actual logs, so concurrent requests cannot overwrite sums.
CREATE OR REPLACE FUNCTION derive_nutrition_totals() RETURNS trigger AS $$
BEGIN
  SELECT COALESCE(sum(meal_kcal), 0) INTO NEW.total_kcal
    FROM meals WHERE daily_nutrition_id = NEW.id;
  SELECT COALESCE(sum(burned_kcal), 0) INTO NEW.total_burned_kcal
    FROM workouts WHERE user_id = NEW.user_id AND date = NEW.date;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER canonical_nutrition_totals BEFORE UPDATE OF total_kcal, total_burned_kcal
ON daily_nutritions FOR EACH ROW EXECUTE FUNCTION derive_nutrition_totals();

CREATE OR REPLACE FUNCTION refresh_meal_totals() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE daily_nutritions SET total_kcal = 0 WHERE id = OLD.daily_nutrition_id;
    RETURN OLD;
  END IF;
  UPDATE daily_nutritions SET total_kcal = 0 WHERE id = NEW.daily_nutrition_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS meal_totals_changed ON meals;
CREATE TRIGGER meal_totals_changed AFTER INSERT OR UPDATE OR DELETE ON meals
FOR EACH ROW EXECUTE FUNCTION refresh_meal_totals();

CREATE OR REPLACE FUNCTION refresh_workout_totals() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE daily_nutritions SET total_burned_kcal = 0 WHERE user_id = OLD.user_id AND date = OLD.date;
    RETURN OLD;
  END IF;
  UPDATE daily_nutritions SET total_burned_kcal = 0 WHERE user_id = NEW.user_id AND date = NEW.date;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS workout_totals_changed ON workouts;
CREATE TRIGGER workout_totals_changed AFTER INSERT OR UPDATE OR DELETE ON workouts
FOR EACH ROW EXECUTE FUNCTION refresh_workout_totals();
UPDATE daily_nutritions SET total_kcal = 0, total_burned_kcal = 0;
COMMIT;
