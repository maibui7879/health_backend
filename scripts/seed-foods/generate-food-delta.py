"""Sinh migration DELTA cho catalog thực phẩm (thay generate-010.py).

010-foods-vn-expand.sql đã FROZEN (đã applied 001-014 là immutable) — KHÔNG
regenerate/ghi đè nó. Muốn thêm/sửa món: sửa CSV/JSON rồi chạy script này,
nó sinh file mới 016-foods-delta-*.sql chỉ chứa INSERT theo `code`.

Quy ước code ổn định:
  VFCT-0001.. theo thứ tự vfct_foods_final.csv (526 dòng)
  EST-0001..  theo thứ tự cooked-dishes.json
Seed upsert theo `code` (INSERT ... ON CONFLICT DO NOTHING không chỉ target
để bỏ qua cả trùng code lẫn trùng tên), KHÔNG đè macro đã hiệu chỉnh tay.
Rename hiển thị: giữ food_name_vi canonical, đặt tên đẹp vào display_name_vi
qua migration tay riêng — xem 015-foods-stable-codes.sql.

Chạy: python scripts/seed-foods/generate-food-delta.py [--out 016-foods-delta.sql]
"""

import argparse
import csv
import json
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent
MIGRATIONS = BASE.parent.parent / "src" / "database" / "migrations"


def num(v, default=0.0):
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def sql_str(v):
    if v is None:
        return "NULL"
    return "'" + str(v).replace("'", "''") + "'"


def load_values():
    values = []
    with open(BASE / "vfct_foods_final.csv", encoding="utf-8") as f:
        for i, r in enumerate(csv.DictReader(f), 1):
            vi = " ".join(r["name_vn"].split())
            en = " ".join((r["name_en"] or "").split()) or None
            if not vi:
                continue
            code = f"VFCT-{i:04d}"
            values.append(
                f"  ({sql_str(code)}, {sql_str(vi)}, NULL, {sql_str(en)}, "
                f"{num(r['energy_kcal'])}, {num(r['protein_g'])}, "
                f"{num(r['carb_g'])}, {num(r['fat_g'])}, 'VFCT 2007')"
            )
    with open(BASE / "cooked-dishes.json", encoding="utf-8") as f:
        for i, d in enumerate(json.load(f), 1):
            code = f"EST-{i:04d}"
            values.append(
                f"  ({sql_str(code)}, {sql_str(d['vi'])}, NULL, {sql_str(d['en'])}, "
                f"{num(d['kcal'])}, {num(d['p'])}, "
                f"{num(d['c'])}, {num(d['f'])}, 'estimate')"
            )
    return values


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="016-foods-delta.sql")
    args = ap.parse_args()
    if "010" in args.out:
        print("REFUSED: 010 đã frozen, dùng tên file mới (VD 016-foods-delta.sql).",
              file=sys.stderr)
        sys.exit(1)
    out = MIGRATIONS / args.out
    if out.exists():
        print(f"REFUSED: {out.name} đã tồn tại — dùng tên mới để giữ "
              "migrations immutable.", file=sys.stderr)
        sys.exit(1)
    values = load_values()
    header = """-- Delta catalog thực phẩm (sinh tự động, KHÔNG sửa tay).
-- Nguồn: scripts/seed-foods/*.csv|json. Upsert theo `code`, không đè tay.
-- Xem 015-foods-stable-codes.sql + generate-food-delta.py.

INSERT INTO foods (code, food_name_vi, display_name_vi, food_name_en, kcal_100g, protein_100g, carbs_100g, fat_100g, source) VALUES
"""
    out.write_text(header + ",\n".join(values) + "\nON CONFLICT DO NOTHING;\n",
                   encoding="utf-8")
    print(f"wrote {len(values)} rows -> {out}")


if __name__ == "__main__":
    main()
