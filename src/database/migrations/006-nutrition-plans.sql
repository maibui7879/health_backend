-- Migration: bảng plan dinh dưỡng đang theo (so plan vs thực tế)
-- Tự chạy khi backend boot (src/database/migrator.ts).

CREATE TABLE IF NOT EXISTS nutrition_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200) NULL,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  goal_summary TEXT NULL,
  goal_snapshot JSONB NULL,
  items JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','COMPLETED','ABANDONED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nutrition_plans_user ON nutrition_plans (user_id);
CREATE INDEX IF NOT EXISTS idx_nutrition_plans_user_status
  ON nutrition_plans (user_id, status);
