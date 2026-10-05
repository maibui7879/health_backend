"""FROZEN — 010-foods-vn-expand.sql là immutable (đã applied).
KHÔNG chạy script này nữa. Dùng generate-food-delta.py để sinh file delta mới.
Script giữ lại để chặn ghi đè vô tình.
"""

import sys


def main():
    print(
        "REFUSED: 010 đã frozen. Sửa CSV/JSON rồi chạy "
        "python scripts/seed-foods/generate-food-delta.py --out 016-foods-delta.sql",
        file=sys.stderr,
    )
    sys.exit(1)


if __name__ == "__main__":
    main()
