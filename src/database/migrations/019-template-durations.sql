-- Migration: duration là tham số buổi tập, không phải định danh bài (Phase 5B fix).
-- Vấn đề: seed 017 nhúng duration vào tên ("Chạy interval 20 phút") nên cùng
-- động tác khác duration phải đẻ template mới — media không chuẩn được.
-- Fix: tên template chỉ mô tả ĐỘNG TÁC + level, thêm default_duration_minutes
-- gợi ý; log session override duration tự do, media theo template.

ALTER TABLE exercise_templates
  ADD COLUMN IF NOT EXISTS default_duration_minutes INT NULL;

UPDATE exercise_templates SET name_vi = 'Chạy nhẹ', name_en = 'Easy run', default_duration_minutes = 15 WHERE code = 'RUN-EASY-01';
UPDATE exercise_templates SET name_vi = 'Chạy interval', name_en = 'Interval run', default_duration_minutes = 20 WHERE code = 'RUN-MED-01';
UPDATE exercise_templates SET name_vi = 'Chạy bền', name_en = 'Endurance run', default_duration_minutes = 45 WHERE code = 'RUN-HARD-01';
UPDATE exercise_templates SET name_vi = 'Đạp xe dạo', name_en = 'Leisure ride', default_duration_minutes = 20 WHERE code = 'CYC-EASY-01';
UPDATE exercise_templates SET name_vi = 'Đạp xe giữ nhịp', name_en = 'Steady ride', default_duration_minutes = 30 WHERE code = 'CYC-MED-01';
UPDATE exercise_templates SET name_vi = 'Đạp leo dốc HIIT', name_en = 'Hill climb HIIT', default_duration_minutes = 25 WHERE code = 'CYC-HARD-01';
UPDATE exercise_templates SET name_vi = 'Tạ nhẹ toàn thân', name_en = 'Light full-body weights', default_duration_minutes = 20 WHERE code = 'LIFT-EASY-01';
UPDATE exercise_templates SET name_vi = 'Đẩy kéo 4 hiệp', name_en = 'Push-pull 4 sets', default_duration_minutes = 35 WHERE code = 'LIFT-MED-01';
UPDATE exercise_templates SET name_vi = 'Giáo án sức mạnh 5x5', name_en = '5x5 strength program', default_duration_minutes = 50 WHERE code = 'LIFT-HARD-01';
UPDATE exercise_templates SET name_vi = 'Yoga chào mặt trời', name_en = 'Sun salutation flow', default_duration_minutes = 15 WHERE code = 'YOGA-EASY-01';
UPDATE exercise_templates SET name_vi = 'Yoga core', name_en = 'Core yoga', default_duration_minutes = 25 WHERE code = 'YOGA-MED-01';
UPDATE exercise_templates SET name_vi = 'Yoga power', name_en = 'Power yoga', default_duration_minutes = 40 WHERE code = 'YOGA-HARD-01';
UPDATE exercise_templates SET name_vi = 'Bơi sải nhẹ', name_en = 'Easy freestyle', default_duration_minutes = 15 WHERE code = 'SWIM-EASY-01';
UPDATE exercise_templates SET name_vi = 'Bơi interval', name_en = 'Swim intervals', default_duration_minutes = 30 WHERE code = 'SWIM-MED-01';
UPDATE exercise_templates SET name_vi = 'Bơi bền 1km', name_en = '1km endurance swim', default_duration_minutes = 40 WHERE code = 'SWIM-HARD-01';
UPDATE exercise_templates SET name_vi = 'Đi bộ nhanh', name_en = 'Brisk walk', default_duration_minutes = 20 WHERE code = 'CARDIO-EASY-01';
UPDATE exercise_templates SET name_vi = 'HIIT nhẹ nhàng', name_en = 'Low-impact HIIT', default_duration_minutes = 25 WHERE code = 'CARDIO-MED-01';
UPDATE exercise_templates SET name_vi = 'HIIT Tabata', name_en = 'Tabata HIIT', default_duration_minutes = 30 WHERE code = 'CARDIO-HARD-01';
