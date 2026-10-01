-- Tự vá schema (idempotent) — chạy MỖI lần backend boot, sau migrations.
-- Mục đích: tự phục hồi khi DB bị sửa từ bên ngoài (VD: cột locale bị xóa
-- dù migration 002 đã ghi applied). Chỉ chứa DDL an toàn IF NOT EXISTS.
-- Chạy tay (nếu cần): psql "$DATABASE_URL" -f src/database/repair.sql

-- user_settings.locale (dùng cho i18n + interceptor)
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS locale VARCHAR(5) DEFAULT 'vi';
UPDATE user_settings SET locale = 'vi' WHERE locale IS NULL;

-- Bảng AI chat
CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL DEFAULT 'Hội thoại mới',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_updated
  ON ai_conversations (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user','assistant','system','tool')),
  content TEXT NOT NULL DEFAULT '',
  tool_calls JSONB NULL,
  tool_call_id VARCHAR(100) NULL,
  tokens_used INT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conv_created
  ON ai_messages (conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_ai_messages_user_created
  ON ai_messages (user_id, created_at DESC);

-- Bảng OTP đặt lại mật khẩu
CREATE TABLE IF NOT EXISTS password_reset_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  code_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_password_reset_otps_email
  ON password_reset_otps (email);

-- Bảng plan dinh dưỡng đang theo (so plan vs thực tế)
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

-- Bảng OTP đăng ký 2 bước
CREATE TABLE IF NOT EXISTS registration_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  code_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_registration_otps_email
  ON registration_otps (email);

-- Bảng lịch nhắc push notification (tên user_reminders để tránh đụng
-- bảng reminders có sẵn của app khác)
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

-- Catalog thực phẩm tra cứu chung + món yêu thích
CREATE TABLE IF NOT EXISTS foods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  food_name_vi VARCHAR(255) NOT NULL UNIQUE,
  food_name_en VARCHAR(255) NULL,
  kcal_100g FLOAT NOT NULL DEFAULT 0,
  protein_100g FLOAT NOT NULL DEFAULT 0,
  carbs_100g FLOAT NOT NULL DEFAULT 0,
  fat_100g FLOAT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_foods_name_vi ON foods (food_name_vi);
CREATE INDEX IF NOT EXISTS idx_foods_name_en ON foods (food_name_en);
ALTER TABLE foods ADD COLUMN IF NOT EXISTS source VARCHAR(30) NULL;

CREATE TABLE IF NOT EXISTS favorite_foods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  food_id UUID NULL REFERENCES foods(id) ON DELETE SET NULL,
  food_name_vi VARCHAR(255) NOT NULL,
  food_name_en VARCHAR(255) NULL,
  kcal_100g FLOAT NOT NULL DEFAULT 0,
  protein_100g FLOAT NOT NULL DEFAULT 0,
  carbs_100g FLOAT NOT NULL DEFAULT 0,
  fat_100g FLOAT NOT NULL DEFAULT 0,
  note VARCHAR(255) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_favorite_foods_user ON favorite_foods (user_id);

-- Community Phase 4: bài đăng, bình luận, tương tác, báo cáo
CREATE TABLE IF NOT EXISTS community_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  image_url VARCHAR(500) NULL,
  linked_type VARCHAR(20) NULL
    CHECK (linked_type IN ('NUTRITION_PLAN','WORKOUT','MEAL')),
  linked_id UUID NULL,
  linked_snapshot JSONB NULL,
  is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  like_count INT NOT NULL DEFAULT 0,
  comment_count INT NOT NULL DEFAULT 0,
  report_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_community_posts_feed
  ON community_posts (is_hidden, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_user
  ON community_posts (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS community_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_community_comments_post
  ON community_comments (post_id, created_at ASC);

CREATE TABLE IF NOT EXISTS community_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL DEFAULT 'LIKE' CHECK (type IN ('LIKE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_community_reactions_post
  ON community_reactions (post_id);

CREATE TABLE IF NOT EXISTS community_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason VARCHAR(500) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','REVIEWED','DISMISSED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, reporter_id)
);
CREATE INDEX IF NOT EXISTS idx_community_reports_post
  ON community_reports (post_id);
