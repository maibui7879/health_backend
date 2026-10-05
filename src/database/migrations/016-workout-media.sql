-- Migration: media minh họa cho workout log (Phase 5A).
-- media_url: file upload (/uploads/workouts/...) hoặc link ngoài (YouTube).
-- media_type: 'image' | 'video' | 'youtube'. media_viewed_at: FE báo khi
-- user xem hết (phục vụ streak 5C). Idempotent.

ALTER TABLE workouts ADD COLUMN IF NOT EXISTS media_url VARCHAR(500) NULL;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS media_type VARCHAR(10) NULL;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS media_viewed_at TIMESTAMPTZ NULL;
