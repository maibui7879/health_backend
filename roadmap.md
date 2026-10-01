# Backend Roadmap — BeroHealth API

Đối chiếu theo bảng yêu cầu sản phẩm (09/2026). Cập nhật khi xong mục nào.

## Phase 1 — Chặn user thật (làm trước) ✅ XONG (01/10/2026)

- [x] **Đổi mật khẩu khi đã đăng nhập**: `POST /auth/change-password` (xác thực mật khẩu cũ + mật khẩu mới ≥ 6 ký tự)
- [x] **Quên mật khẩu**: `POST /auth/forgot-password` (gửi OTP/mail) + `POST /auth/reset-password` (xác thực OTP + đặt pass mới)
  - Chốt: OTP qua email (dùng `MAIL_*` + nodemailer). ⚠️ **Gmail trong `.env` báo `535 BadCredentials`** — cần thay App Password mới thì mail mới tới tay user được (flow vẫn chạy, OTP vẫn lưu DB)

## Phase 2 — Nhắc nhở push ✅ XONG (01/10/2026)

Hạ tầng `device_token` đã có.
- [x] Chọn provider: **Expo Push** (`expo-server-sdk`, không cần config native thêm)
- [x] `GET/POST/PATCH/DELETE /reminders`: CRUD lịch nhắc (giờ UTC `HH:mm`, ngày 0–6, bật/tắt, tiêu đề/nội dung tùy chọn)
- [x] Cron mỗi phút quét lịch đến giờ + chống bắn trùng 90s + tôn trọng `remind_water`/`remind_meals` trong settings
- [x] Tự xóa device token chết (`DeviceNotRegistered`), message theo locale từng user
- [ ] FE: đăng ký push token sau login (`PUT /users/device-token`) + màn hình quản lý lịch nhắc — CHƯA LÀM

## Phase 3 — Dinh dưỡng nâng cao

- [x] **Lưu plan đang theo** (01/10/2026): bảng `nutrition_plans` (migration 006) + CRUD `POST/GET/PATCH /nutrition/plans` — 1 ACTIVE/user, tạo mới/kích hoạt lại tự archive cái cũ, i18n vi/en
- [x] **So plan vs thực tế + AI nhận xét** (01/10/2026): `GET /nutrition/plans[/:id]/adherence?date=` (điểm kcal/tập/nước, verdict ON_TRACK→OFF_TRACK) + `POST /ai/review-day` (Groq nhận xét từng bữa, buổi tập, gợi ý mai, marker y tế)
- [x] **Template core đợt 1** (01/10/2026): `nutrition_plans` + `is_template/cover_emoji/use_count` (migration 008) + `POST /plans/:id/publish` (chỉ COMPLETED, điểm TB ≥70) + `GET /plans/templates` (hot/new + tên tác giả) + `POST /plans/templates/:id/clone` (snapshot tách bạch, tự archive ACTIVE cũ, `use_count+1`)
- [x] **DB tra cứu thực phẩm chung** (01/10/2026): bảng `foods` (tên vi/en, kcal/protein/carbs/fat/100g) + `GET /foods/search` (ILIKE 2 tên, cap 50) + `GET /foods/:id`, seed 24 món Việt ước tính (migration 007)
- [x] **Mở rộng catalog lên ~574 món** (01/10/2026, Hướng 2): import Bảng thành phần thực phẩm VN 2007 (Viện Dinh dưỡng/Bộ Y tế, mirror FAO — 526 nguyên liệu vi+en chuẩn, parse PDF + decode font TCVN3 có kiểm chứng) + ~48 món nấu phổ biến ước tính (VFCT không có món tổng hợp) — migration 010, cột `source` (`VFCT 2007`/`estimate`), script tái tạo trong `scripts/seed-foods/`
- [x] **Món yêu thích** (01/10/2026): bảng `favorite_foods` + CRUD `GET/POST/DELETE /favorites` — từ catalog (snapshot giá trị) hoặc tự nhập, chống trùng 409, phân quyền 403/404
- [x] **BMI** (có sẵn): `src/users/bmi.ts` tính lúc đọc + phân loại WHO, trả trong `GET /users/me`
- [x] **Cảnh báo lệch TDEE/BMI** (có sẵn): `warnings[]` real-time trong dashboard (`OVER_BUDGET` ≥120%, `UNDER_BUDGET` ≤50%, `UNSAFE_MEAL`)
- [ ] **Tự điều chỉnh plan**: khi user nhiều ngày không theo (so `daily` vs target), gợi ý plan mới hoặc cảnh báo — hiện chỉ suggest tĩnh

## Phase 4 — Community (module mới) ✅ XONG (01/10/2026)

- [x] Bảng `posts`, `comments`, `reactions` + CRUD bài đăng: `community_posts`, `community_comments`, `community_reactions` (migration 009) + `GET /community/posts` (feed, ẩn bài bị report), `GET /community/posts/mine`, `GET/POST/PATCH/DELETE /community/posts[/:id]` — chỉ chủ bài được sửa/xóa (403/404), i18n vi/en
- [x] Tương tác + comment (phân quyền xóa/sửa của chủ bài): `GET/POST /community/posts/:id/comments`, `PATCH /community/comments/:id` (chỉ chủ comment), `DELETE` (chủ comment hoặc chủ bài), `POST/DELETE /community/posts/:id/like` (idempotent, `like_count`/`comment_count` atomic)
- [x] Chia sẻ thực đơn/đồ tập (link từ nutrition/workout sang post): `linked_type` (`NUTRITION_PLAN`/`WORKOUT`/`MEAL`) + `linked_id` + `linked_snapshot` (chụp lúc đăng, không lộ private), verify quyền sở hữu, feed trả `author{full_name,avatar_url}` + `viewer_has_liked`
- [x] Kiểm duyệt cơ bản (report/hide) nếu cần trước public: `POST /community/posts/:id/report` (chống self-report 400, chống trùng 409, bảng `community_reports`), đủ 3 report → `is_hidden=true` tự ẩn khỏi feed (chủ bài vẫn xem/sửa được, người ngoài 404)

## Phase 5 — Tập luyện nâng cao

- [ ] Media minh họa bài tập (video/hình): field `media_url` cho workout + endpoint upload (tái dùng pattern `/users/avatar`)
- [ ] Ghi nhận xem hết video/hình của ngày → tích streak
- [ ] Set mục tiêu streak + nhận thưởng (hiện chỉ có `is_streak_day` tự tính theo log chung, chưa có mục tiêu riêng cho workout)

## Phase 6 — Pháp lý (cần trước khi public store)

- [ ] Điều khoản sử dụng + chính sách bảo mật: endpoint trả nội dung versioned (`GET /legal/:type`)
- [ ] Ghi nhận user đồng ý điều khoản (`POST /legal/accept`) + chặn dùng app nếu chưa đồng ý (tùy policy)

## TODO để sau (không chặn release)

- [ ] Thay `MAIL_PASS` bằng App Password Gmail mới — SMTP hiện báo `535 BadCredentials`, mail OTP chưa tới tay user (flow code vẫn đúng)

## Đã xong (không làm lại)

- Auth cơ bản: register/login Google + email, refresh token, JWT
- Theo dõi: cân nặng, nước, bữa ăn, tập luyện, mục tiêu dinh dưỡng, thống kê ngày/tuần
- AI: analyze-food, suggest-menu/plan, chat + stream + retry + conversations
- Profile: CRUD, avatar upload + static serve, allergies, settings + locale, i18n vi/en, xóa tài khoản
- Hạ tầng: auto-migrate khi boot (`src/database/migrations`), backfill settings, khởi tạo setting mặc định khi tạo user
