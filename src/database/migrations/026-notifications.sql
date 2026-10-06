-- Migration: trung tâm thông báo (in-app + push theo sự kiện).
-- type: sự kiện phát sinh (duyệt món, xử lý tố cáo, huy hiệu streak...).
-- data: JSON tham số cho FE hiển thị link sâu. is_read cho badge chưa đọc.

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(40) NOT NULL,
  title VARCHAR(200) NOT NULL,
  body VARCHAR(500) NULL,
  data JSONB NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user
  ON notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON notifications (user_id, is_read, created_at DESC);
