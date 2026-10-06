"""Sinh candidate quét toàn catalog (đợt 3): VFCT CSV + món nấu + seed 007,
trừ món đã có ảnh (covered.txt). Article = tên chuẩn, fallback = tên rút gọn
(bỏ ngoặc/phẩy mô tả). Chạy 1 lần, output append vào dishes.csv.
"""
import csv
import json
import re
from pathlib import Path

BASE = Path(__file__).resolve().parent
SEED = BASE.parent / "seed-foods"


def short(name):
    s = re.split(r"[,(\[]", name)[0].strip()
    return s if len(s) >= 2 and s != name else ""


def main():
    covered = set(
        (BASE / "covered.txt").read_text(encoding="utf-8").splitlines()
    ) if (BASE / "covered.txt").exists() else set()
    have = set()
    try:
        for r in csv.DictReader((BASE / "dishes.csv").open(encoding="utf-8")):
            have.add(r["food_name_vi"])
    except FileNotFoundError:
        pass

    names = []
    with open(SEED / "vfct_foods_final.csv", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            vi = " ".join(r["name_vn"].split())
            if vi:
                names.append(vi)
    with open(SEED / "cooked-dishes.json", encoding="utf-8") as f:
        for d in json.load(f):
            names.append(d["vi"])
    # seed 007 (24 món cũ)
    names += [
        "Cơm trắng", "Phở bò", "Bánh mì thịt", "Bún bò Huế", "Cơm gà",
        "Gỏi cuốn", "Bánh xèo", "Chả giò", "Thịt kho trứng", "Cá kho tộ",
        "Rau muống xào", "Canh chua", "Trứng luộc", "Ức gà luộc",
        "Cá hồi nướng", "Thịt bò xào", "Tôm hấp", "Đậu phụ", "Sữa tươi",
        "Chuối", "Táo", "Xoài", "Khoai lang", "Quả bơ",
    ]

    rows = []
    seen = set(have) | covered
    for vi in names:
        if not vi or vi in seen:
            continue
        seen.add(vi)
        rows.append({"food_name_vi": vi, "article": vi, "fallback": short(vi)})

    with (BASE / "dishes.csv").open("a", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["food_name_vi", "article", "fallback"])
        w.writerows(rows)
    print(f"appended {len(rows)} candidates (total catalog pool)")


if __name__ == "__main__":
    main()
