-- Migration: hồ sơ gu ngầm (Phase 7B) — lớp tín hiệu chung cho gợi ý
-- món/workout (7C/7D) và feed community (7F). Ghi incremental theo event,
-- cron đêm decay (xử lý trong InsightsService), không gọi AI.
-- Tự chạy khi backend boot (src/database/migrator.ts).

CREATE TABLE IF NOT EXISTS user_taste_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  liked_tags JSONB NOT NULL DEFAULT '{}',
  disliked_tags JSONB NOT NULL DEFAULT '{}',
  workout_prefs JSONB NOT NULL DEFAULT '{}',
  interactions INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
