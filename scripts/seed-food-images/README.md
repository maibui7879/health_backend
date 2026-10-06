# Seed ảnh món ăn (Wikimedia Commons)

Lead image từ bài vi.wikipedia của món (do editor chọn) + author/license
từ Commons để attribution. Chỉ top món phổ biến, còn lại để NULL.

## Quy trình

```bash
# 1. Thêm dòng vào dishes.csv (food_name_vi canonical, article vi.wikipedia)
# 2. Fetch (throttle sẵn, retry 429):
python scripts/seed-food-images/fetch_images.py
# 3. Review pending.csv (đúng món? ảnh rõ? credit đủ?)
# 4. Emit UPDATE vào 021:
python scripts/seed-food-images/fetch_images.py --emit
```

## Lưu ý

- UPDATE theo `food_name_vi` canonical + `AND image_url IS NULL` (không đè tay).
- `021` đã applied thì không emit thêm vào đó — tạo migration mới.
- Hotlink `thumb.wikimedia.org` cho MVP; lâu dài copy về storage riêng.
