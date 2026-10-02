-- Migration: tìm kiếm mờ tiếng Việt cho catalog thực phẩm (Phase 7A).
-- search_norm: tên vi+en viết thường, bỏ dấu (VD 'Phở bò' -> 'pho bo').
-- Service chuẩn hóa query bằng cùng quy tắc (src/nutrition/search-norm.ts)
-- rồi match ILIKE trước, similarity (pg_trgm) vét sau — chịu được
-- không dấu + gõ sai nhẹ. Tự chạy khi backend boot (migrator.ts).

CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE foods ADD COLUMN IF NOT EXISTS search_norm TEXT NULL;

-- Tự duy trì search_norm cho mọi insert/update sau này.
CREATE OR REPLACE FUNCTION foods_search_norm() RETURNS trigger AS $$
BEGIN
  NEW.search_norm := regexp_replace(
    translate(lower(coalesce(NEW.food_name_vi,'') || ' ' || coalesce(NEW.food_name_en,'')), 'áàạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ', 'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd'), '\s+', ' ', 'g');
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_foods_search_norm ON foods;
CREATE TRIGGER trg_foods_search_norm
  BEFORE INSERT OR UPDATE OF food_name_vi, food_name_en ON foods
  FOR EACH ROW EXECUTE FUNCTION foods_search_norm();

-- Backfill hàng cũ (đi qua trigger để khỏi lặp lại biểu thức).
UPDATE foods SET food_name_vi = food_name_vi WHERE search_norm IS NULL;

CREATE INDEX IF NOT EXISTS idx_foods_search_norm
  ON foods USING gin (search_norm gin_trgm_ops);
