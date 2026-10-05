-- Migration: catalog bài tập mẫu (Phase 5B).
-- Seed 18 template (6 ActivityType x 3 độ khó) để FE/AI luôn có nội dung
-- hiển thị trước prod. demo_video_url NULL — admin bổ sung sau, không bịa link.
-- Upsert theo `code`, KHÔNG đè khi chạy lại.

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

INSERT INTO exercise_templates (code, activity_type, name_vi, name_en, muscle_groups, difficulty, demo_video_url, cover_emoji, is_active) VALUES
  ('RUN-EASY-01', 'RUNNING', 'Chạy nhẹ quanh nhà', 'Easy neighborhood run', '{legs,cardio}', 'EASY', NULL, '🏃', TRUE),
  ('RUN-MED-01', 'RUNNING', 'Chạy interval 20 phút', '20-min interval run', '{legs,cardio}', 'MEDIUM', NULL, '🏃', TRUE),
  ('RUN-HARD-01', 'RUNNING', 'Chạy bền 45 phút', '45-min endurance run', '{legs,cardio}', 'HARD', NULL, '🏃', TRUE),
  ('CYC-EASY-01', 'CYCLING', 'Đạp xe dạo phố', 'Leisure city ride', '{legs,cardio}', 'EASY', NULL, '🚴', TRUE),
  ('CYC-MED-01', 'CYCLING', 'Đạp xe 30 phút giữ nhịp', '30-min steady ride', '{legs,cardio}', 'MEDIUM', NULL, '🚴', TRUE),
  ('CYC-HARD-01', 'CYCLING', 'Đạp leo dốc HIIT', 'Hill climb HIIT ride', '{legs,cardio}', 'HARD', NULL, '🚴', TRUE),
  ('LIFT-EASY-01', 'WEIGHT_LIFTING', 'Tạ nhẹ toàn thân', 'Light full-body weights', '{upper,core}', 'EASY', NULL, '🏋️', TRUE),
  ('LIFT-MED-01', 'WEIGHT_LIFTING', 'Đẩy kéo 4 hiệp', 'Push-pull 4 sets', '{upper,core}', 'MEDIUM', NULL, '🏋️', TRUE),
  ('LIFT-HARD-01', 'WEIGHT_LIFTING', 'Giáo án sức mạnh 5x5', '5x5 strength program', '{upper,core}', 'HARD', NULL, '🏋️', TRUE),
  ('YOGA-EASY-01', 'YOGA', 'Yoga chào mặt trời', 'Sun salutation flow', '{flexibility,core}', 'EASY', NULL, '🧘', TRUE),
  ('YOGA-MED-01', 'YOGA', 'Yoga core 25 phút', '25-min core yoga', '{flexibility,core}', 'MEDIUM', NULL, '🧘', TRUE),
  ('YOGA-HARD-01', 'YOGA', 'Yoga power 40 phút', '40-min power yoga', '{flexibility,core}', 'HARD', NULL, '🧘', TRUE),
  ('SWIM-EASY-01', 'SWIMMING', 'Bơi sải nhẹ 15 phút', '15-min easy freestyle', '{upper,cardio,full}', 'EASY', NULL, '🏊', TRUE),
  ('SWIM-MED-01', 'SWIMMING', 'Bơi interval 30 phút', '30-min swim intervals', '{upper,cardio,full}', 'MEDIUM', NULL, '🏊', TRUE),
  ('SWIM-HARD-01', 'SWIMMING', 'Bơi bền 1km', '1km endurance swim', '{upper,cardio,full}', 'HARD', NULL, '🏊', TRUE),
  ('CARDIO-EASY-01', 'CARDIO', 'Đi bộ nhanh 20 phút', '20-min brisk walk', '{cardio,legs}', 'EASY', NULL, '❤️', TRUE),
  ('CARDIO-MED-01', 'CARDIO', 'HIIT không nhảy 25 phút', '25-min low-impact HIIT', '{cardio,legs}', 'MEDIUM', NULL, '❤️', TRUE),
  ('CARDIO-HARD-01', 'CARDIO', 'HIIT Tabata 30 phút', '30-min Tabata HIIT', '{cardio,legs}', 'HARD', NULL, '❤️', TRUE)
ON CONFLICT (code) DO NOTHING;

-- Log user có thể gắn template có sẵn (nullable, xóa template thì giữ log).
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS template_id UUID NULL REFERENCES exercise_templates(id) ON DELETE SET NULL;
