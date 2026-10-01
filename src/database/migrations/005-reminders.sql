-- Migration: bảng lịch nhắc push notification
-- Tên bảng user_reminders để tránh đụng bảng reminders có sẵn của app khác.
-- Tự chạy khi backend boot (src/database/migrator.ts).

CREATE TABLE IF NOT EXISTS user_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('MEAL','WATER','WORKOUT','WEIGHT','PROGRESS')),
  time VARCHAR(5) NOT NULL,
  days INT[] NOT NULL DEFAULT '{}',
  title VARCHAR(120) NULL,
  body VARCHAR(255) NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_sent_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_reminders_user ON user_reminders (user_id);
CREATE INDEX IF NOT EXISTS idx_user_reminders_due ON user_reminders (enabled, time);
