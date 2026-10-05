-- Migration: mục tiêu streak workout + badge thưởng (Phase 5C).
-- 1 ACTIVE/user tại một thời điểm. Cron daily chốt ACTIVE -> COMPLETED
-- (đủ target_days ngày liên tiếp, badge 'STREAK_<N>') hoặc FAILED (đứt mạch).

CREATE TABLE IF NOT EXISTS workout_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_days INT NOT NULL CHECK (target_days IN (7, 14, 30)),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','COMPLETED','FAILED')),
  badge VARCHAR(30) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS idx_workout_goals_user_status
  ON workout_goals (user_id, status);
