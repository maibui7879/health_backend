-- Migration: hệ thống report chung (moderation).
-- Phạm vi: POST/COMMENT/USER/WORKOUT/EXERCISE_TEMPLATE/FOOD.
-- Copy dữ liệu community_reports cũ sang để auto-hide + lịch sử liền mạch.
-- Bảng community_reports cũ giữ nguyên (đóng băng, không ghi thêm).

CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type VARCHAR(20) NOT NULL
    CHECK (target_type IN ('POST','COMMENT','USER','WORKOUT','EXERCISE_TEMPLATE','FOOD')),
  target_id UUID NOT NULL,
  category VARCHAR(20) NOT NULL DEFAULT 'OTHER'
    CHECK (category IN ('SPAM','INAPPROPRIATE','MISINFORMATION','HARASSMENT','OTHER')),
  details VARCHAR(500) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','ACTIONED','DISMISSED')),
  action_taken VARCHAR(30) NULL,
  reviewer_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (reporter_id, target_type, target_id)
);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_target ON reports (target_type, target_id);

-- Mang dữ liệu cũ sang (giữ nguyên bảng cũ). reason -> details, category OTHER.
INSERT INTO reports (reporter_id, target_type, target_id, category, details, status, created_at)
SELECT reporter_id, 'POST', post_id, 'OTHER', reason, 'PENDING', created_at
FROM community_reports
ON CONFLICT (reporter_id, target_type, target_id) DO NOTHING;
