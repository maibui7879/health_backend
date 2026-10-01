-- Migration: plan mẫu (template) để chia sẻ + bê về
-- Tự chạy khi backend boot (src/database/migrator.ts).

ALTER TABLE nutrition_plans
  ADD COLUMN IF NOT EXISTS is_template BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE nutrition_plans
  ADD COLUMN IF NOT EXISTS cover_emoji VARCHAR(10) NULL;
ALTER TABLE nutrition_plans
  ADD COLUMN IF NOT EXISTS use_count INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_nutrition_plans_templates
  ON nutrition_plans (is_template, use_count DESC);
