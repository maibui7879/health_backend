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
ALTER TABLE foods ADD COLUMN IF NOT EXISTS code VARCHAR(60) NULL;
ALTER TABLE foods ADD COLUMN IF NOT EXISTS display_name_vi VARCHAR(255) NULL;
ALTER TABLE foods ADD COLUMN IF NOT EXISTS image_url VARCHAR(500) NULL;
ALTER TABLE foods ADD COLUMN IF NOT EXISTS image_credit VARCHAR(255) NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_foods_code ON foods (code);

-- Tìm kiếm mờ tiếng Việt (Phase 7A + fix 015): search_norm + trigger + index trigram.
-- 015: gồm cả display_name_vi để rename hiển thị vẫn tìm được.

-- Tìm kiếm mờ tiếng Việt (Phase 7A): search_norm + trigger + index trigram.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
ALTER TABLE foods ADD COLUMN IF NOT EXISTS search_norm TEXT NULL;
CREATE OR REPLACE FUNCTION foods_search_norm() RETURNS trigger AS $$
BEGIN
  NEW.search_norm := regexp_replace(
    translate(lower(coalesce(NEW.food_name_vi,'') || ' ' || coalesce(NEW.display_name_vi,'') || ' ' || coalesce(NEW.food_name_en,'')), 'áàạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ', 'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd'), '\s+', ' ', 'g');
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_foods_search_norm ON foods;
CREATE TRIGGER trg_foods_search_norm
  BEFORE INSERT OR UPDATE OF food_name_vi, display_name_vi, food_name_en ON foods
  FOR EACH ROW EXECUTE FUNCTION foods_search_norm();
UPDATE foods SET food_name_vi = food_name_vi WHERE search_norm IS NULL;
CREATE INDEX IF NOT EXISTS idx_foods_search_norm
  ON foods USING gin (search_norm gin_trgm_ops);

-- Workout media (Phase 5A): minh họa per-log + viewed cho streak.
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS media_url VARCHAR(500) NULL;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS media_type VARCHAR(10) NULL;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS media_viewed_at TIMESTAMPTZ NULL;

-- Workout catalog mẫu (Phase 5B).
CREATE TABLE IF NOT EXISTS exercise_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(60) NOT NULL UNIQUE,
  activity_type VARCHAR(20) NOT NULL,
  name_vi VARCHAR(255) NOT NULL,
  name_en VARCHAR(255) NULL,
  muscle_groups TEXT[] NOT NULL DEFAULT '{}',
  difficulty VARCHAR(10) NOT NULL DEFAULT 'EASY',
  demo_video_url VARCHAR(500) NULL,
  cover_emoji VARCHAR(10) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_exercise_templates_activity
  ON exercise_templates (activity_type, is_active);
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS template_id UUID NULL;
ALTER TABLE exercise_templates
  ADD COLUMN IF NOT EXISTS default_duration_minutes INT NULL;

-- Workout goals (Phase 5C): mục tiêu streak + badge.
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

-- Vector/RAG (Phase 8): embeddings món ăn + tóm tắt chat.CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE foods ADD COLUMN IF NOT EXISTS embedding vector(768) NULL;
CREATE INDEX IF NOT EXISTS idx_foods_embedding
  ON foods USING hnsw (embedding vector_cosine_ops);
ALTER TABLE user_taste_profiles
  ADD COLUMN IF NOT EXISTS chat_summary TEXT NULL;
ALTER TABLE user_taste_profiles
  ADD COLUMN IF NOT EXISTS chat_summary_at TIMESTAMPTZ NULL;

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

-- Hồ sơ gu ngầm (Phase 7B): tín hiệu chung cho gợi ý + feed.
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(10) NOT NULL DEFAULT 'USER';

-- Duyệt món user gửi (food moderation).
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

-- Report kiểm duyệt chung (POST/COMMENT/USER/WORKOUT/EXERCISE_TEMPLATE/FOOD).
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
CREATE INDEX IF NOT EXISTS idx_reports_target ON reports (target_type, target_id);CREATE TABLE IF NOT EXISTS user_taste_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  liked_tags JSONB NOT NULL DEFAULT '{}',
  disliked_tags JSONB NOT NULL DEFAULT '{}',
  workout_prefs JSONB NOT NULL DEFAULT '{}',
  interactions INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Feed ngầm (Phase 7F): impression + điểm author.
CREATE TABLE IF NOT EXISTS community_post_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  impressions INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, post_id)
);
CREATE INDEX IF NOT EXISTS idx_community_post_views_user
  ON community_post_views (user_id, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS community_author_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score FLOAT NOT NULL DEFAULT 0,
  interactions INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, author_id)
);
