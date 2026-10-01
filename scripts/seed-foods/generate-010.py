"""Sinh migration 010-foods-vn-expand.sql từ VFCT CSV + món nấu sẵn.

Chạy: python scripts/seed-foods/generate-010.py
Output: src/database/migrations/010-foods-vn-expand.sql
"""

import csv
import json
from pathlib import Path

BASE = Path(__file__).resolve().parent
OUT = (
    BASE.parent.parent
    / "src"
    / "database"
    / "migrations"
    / "010-foods-vn-expand.sql"
)


def num(v, default=0.0):
    try:
        f = float(v)
    except (TypeError, ValueError):
        return default
    return f


def sql_str(v):
    if v is None:
        return "NULL"
    return "'" + str(v).replace("'", "''") + "'"


def main():
    values: list[str] = []

    with open(BASE / "vfct_foods_final.csv", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            vi = " ".join(r["name_vn"].split())
            en = " ".join((r["name_en"] or "").split()) or None
            if not vi:
                continue
            values.append(
                f"  ({sql_str(vi)}, {sql_str(en)}, "
                f"{num(r['energy_kcal'])}, {num(r['protein_g'])}, "
                f"{num(r['carb_g'])}, {num(r['fat_g'])}, 'VFCT 2007')"
            )

    with open(BASE / "cooked-dishes.json", encoding="utf-8") as f:
        for d in json.load(f):
            values.append(
                f"  ({sql_str(d['vi'])}, {sql_str(d['en'])}, "
                f"{num(d['kcal'])}, {num(d['p'])}, "
                f"{num(d['c'])}, {num(d['f'])}, 'estimate')"
            )

    header = """-- Migration: mở rộng catalog thực phẩm (Hướng 2).
-- Nguồn 1: Bảng thành phần thực phẩm Việt Nam 2007 (Viện Dinh dưỡng / Bộ Y tế,
--   mirror FAO) — 526 nguyên liệu, tên vi+en, macro/100g phần ăn được.
--   Parse bằng scripts/seed-foods (xem README) — cột source = 'VFCT 2007'.
-- Nguồn 2: món nấu phổ biến (phở bún... VFCT không có món tổng hợp) —
--   giá trị ước tính, source = 'estimate', dùng tra cứu nhanh.
-- Tự chạy khi backend boot (src/database/migrator.ts).
-- Idempotent: ON CONFLICT (food_name_vi) DO NOTHING.

ALTER TABLE foods ADD COLUMN IF NOT EXISTS source VARCHAR(30) NULL;
UPDATE foods SET source = 'estimate' WHERE source IS NULL;

-- 'Bơ' seed cũ là quả bơ (avocado, 160 kcal); 'Bơ' trong VFCT là bơ sữa
-- (butter, 756 kcal). Tách tên trước khi insert để khỏi đè sai nghĩa.
UPDATE foods SET food_name_vi = 'Quả bơ', food_name_en = 'Avocado'
  WHERE food_name_vi = 'Bơ' AND kcal_100g = 160;

INSERT INTO foods (food_name_vi, food_name_en, kcal_100g, protein_100g, carbs_100g, fat_100g, source) VALUES
"""
    OUT.write_text(header + ",\n".join(values) + "\nON CONFLICT (food_name_vi) DO NOTHING;\n", encoding="utf-8")
    print(f"wrote {len(values)} rows -> {OUT}")


if __name__ == "__main__":
    main()
