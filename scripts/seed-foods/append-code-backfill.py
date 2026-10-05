"""Gán code canonical cho mọi row mang tên gốc (chạy 1 lần, sinh UPDATE vào 015).
Chạy: python scripts/seed-foods/append-code-backfill.py
Ghi thêm block UPDATE vào cuối 015-foods-stable-codes.sql (idempotent).
"""
import csv
import json
from pathlib import Path

BASE = Path(__file__).resolve().parent
F015 = BASE.parent.parent / "src" / "database" / "migrations" / "015-foods-stable-codes.sql"


def sql_str(v):
    if v is None:
        return "NULL"
    return "'" + str(v).replace("'", "''") + "'"


def main():
    pairs = []
    with open(BASE / "vfct_foods_final.csv", encoding="utf-8") as f:
        for i, r in enumerate(csv.DictReader(f), 1):
            vi = " ".join(r["name_vn"].split())
            if not vi:
                continue
            pairs.append((f"VFCT-{i:04d}", vi))
    with open(BASE / "cooked-dishes.json", encoding="utf-8") as f:
        for i, d in enumerate(json.load(f), 1):
            pairs.append((f"EST-{i:04d}", d["vi"]))

    lines = [
        "",
        "-- Backfill code canonical cho row còn mang tên gốc (sinh tự động).",
        "-- Chỉ đụng row LEGACY để không đè hiệu chỉnh đã gán code chuẩn.",
    ]
    for code, vi in pairs:
        lines.append(
            f"UPDATE foods SET code = '{code}' "
            f"WHERE food_name_vi = {sql_str(vi)} AND code LIKE 'LEGACY-%';"
        )
    block = "\n".join(lines) + "\n"
    text = F015.read_text(encoding="utf-8")
    if "Backfill code canonical cho row còn mang tên gốc" in text:
        print("already backfilled, skip")
        return
    F015.write_text(text + block, encoding="utf-8")
    print(f"appended {len(pairs)} updates -> 015")


if __name__ == "__main__":
    main()
