# Seed catalog thực phẩm (Hướng 2)

## Nguồn dữ liệu

1. **Bảng thành phần thực phẩm Việt Nam 2007** — Viện Dinh dưỡng / Bộ Y tế
   (mirror FAO `VTN_FCT_2007.pdf`): 526 nguyên liệu, tên vi+en, macro/100g
   phần ăn được. Cột `source = 'VFCT 2007'`.
2. **Món nấu phổ biến** (`cooked-dishes.json`, ~48 món: bún/phở/cơm/bánh...):
   VFCT không có món tổng hợp nên bổ sung thủ công, giá trị **ước tính**
   (`source = 'estimate'`, cùng mức với 24 seed cũ trong migration 007).

## Tái tạo từ PDF gốc

```bash
pip install pypdf
curl -L -o VTN_FCT_2007.pdf \
  https://www.fao.org/fileadmin/templates/food_composition/documents/pdf/VTN_FCT_2007.pdf
# 1. parse thô (repo RoiArthurB/vfct-to-sparkyfitness-import, chỉ lấy vfct_parser.py)
python vfct_parser.py VTN_FCT_2007.pdf vfct_foods.csv
# 2. vá tên layout-header + group (xem repo BE để lấy script, hoặc hỏi agent)
# 3. chốt EN thiếu + strip mojibake -> vfct_foods_final.csv
python scripts/seed-foods/generate-010.py  # sinh migration 010
```

## Lưu ý chất lượng

- PDF dùng font TCVN3 legacy cho tên Việt → decode có kiểm chứng tay
  (mẫu ngẫu nhiên + quét ký tự lạ toàn bảng). Thêm map `μ (U+03BC) → à`.
- 10 món PDF gốc thiếu tên Anh → dịch thủ công (`Cá mỡ` giữ `Ca mo fish`
  vì chưa có tên Anh chuẩn).
- Năng lượng theo công thức VFCT (4P+9F+4C, chưa tính cồn) — đồ uống có cồn
  hiển thị ~0 kcal đúng theo nguồn, không phải lỗi parse.
- Muốn thêm món: sửa `cooked-dishes.json` rồi chạy lại `generate-010.py`
  (migration dùng `ON CONFLICT DO NOTHING` nên an toàn chạy lại).
