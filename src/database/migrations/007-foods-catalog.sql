-- Migration: catalog thực phẩm tra cứu chung + seed dữ liệu mẫu
-- Tự chạy khi backend boot (src/database/migrator.ts).
-- Giá trị dinh dưỡng là ước tính /100g, dùng tra cứu nhanh, không thay tư vấn y tế.

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

INSERT INTO foods (food_name_vi, food_name_en, kcal_100g, protein_100g, carbs_100g, fat_100g) VALUES
  ('Cơm trắng', 'White rice', 130, 2.7, 28.2, 0.3),
  ('Phở bò', 'Beef pho', 95, 6.5, 12, 2.5),
  ('Bánh mì thịt', 'Vietnamese sandwich', 250, 10, 33, 9),
  ('Bún bò Huế', 'Hue beef noodles', 105, 7, 13, 3),
  ('Cơm gà', 'Chicken rice', 150, 9, 20, 4),
  ('Gỏi cuốn', 'Fresh spring rolls', 110, 5, 16, 2.5),
  ('Bánh xèo', 'Crispy pancake', 220, 7, 20, 12),
  ('Chả giò', 'Fried spring rolls', 260, 8, 18, 16),
  ('Thịt kho trứng', 'Braised pork with egg', 200, 12, 4, 15),
  ('Cá kho tộ', 'Caramelized fish', 140, 14, 8, 6),
  ('Rau muống xào', 'Stir-fried morning glory', 80, 3, 8, 4),
  ('Canh chua', 'Sour soup', 40, 3, 5, 1),
  ('Trứng luộc', 'Boiled egg', 155, 13, 1, 11),
  ('Ức gà luộc', 'Boiled chicken breast', 150, 30, 0, 3.5),
  ('Cá hồi nướng', 'Grilled salmon', 208, 20, 0, 13),
  ('Thịt bò xào', 'Stir-fried beef', 180, 20, 3, 9),
  ('Tôm hấp', 'Steamed shrimp', 100, 22, 1, 1),
  ('Đậu phụ', 'Tofu', 76, 8, 2, 4.5),
  ('Sữa tươi', 'Whole milk', 62, 3.3, 4.8, 3.3),
  ('Chuối', 'Banana', 89, 1.1, 23, 0.3),
  ('Táo', 'Apple', 52, 0.3, 14, 0.2),
  ('Xoài', 'Mango', 60, 0.8, 15, 0.4),
  ('Khoai lang', 'Sweet potato', 86, 1.6, 20, 0.1),
  ('Bơ', 'Avocado', 160, 2, 9, 15)
ON CONFLICT (food_name_vi) DO NOTHING;
