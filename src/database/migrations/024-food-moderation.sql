-- Migration: phân quyền admin + duyệt món user gửi (food moderation).
-- users.role: 'USER' mặc định, 'ADMIN' gán tay (UPDATE SQL bootstrap).
-- food_submissions: user gửi món -> PENDING; admin APPROVED (sinh row foods
-- mới, code 'USER-<id8>', source 'user') hoặc REJECTED. Lịch sử giữ lại.

ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(10) NOT NULL DEFAULT 'USER';

CREATE TABLE IF NOT EXISTS food_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  food_name_vi VARCHAR(255) NOT NULL,
  food_name_en VARCHAR(255) NULL,
  kcal_100g FLOAT NOT NULL DEFAULT 0,
  protein_100g FLOAT NOT NULL DEFAULT 0,
  carbs_100g FLOAT NOT NULL DEFAULT 0,
  fat_100g FLOAT NOT NULL DEFAULT 0,
  image_url VARCHAR(500) NULL,
  note VARCHAR(255) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  reviewer_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_food_submissions_status
  ON food_submissions (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_food_submissions_user
  ON food_submissions (user_id, created_at DESC);
