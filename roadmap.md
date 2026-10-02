# Backend Roadmap — BeroHealth API

Đối chiếu theo bảng yêu cầu sản phẩm (09/2026). Cập nhật khi xong mục nào.

## Phase 1 — Chặn user thật (làm trước) ✅ XONG (01/10/2026)

- [x] **Đổi mật khẩu khi đã đăng nhập**: `POST /auth/change-password` (xác thực mật khẩu cũ + mật khẩu mới ≥ 6 ký tự)
- [x] **Quên mật khẩu**: `POST /auth/forgot-password` (gửi OTP/mail) + `POST /auth/reset-password` (xác thực OTP + đặt pass mới)
  - Chốt: OTP qua email (dùng `MAIL_*` + nodemailer). ✅ App Password mới đã thay (01/10/2026, SMTP verify OK)

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

## Phase 7 — Cá nhân hóa ngầm, 0 token (không gọi AI) 🆕

Nguyên tắc: explicit (dị ứng, mục tiêu, bệnh) = ràng buộc cứng, không bao giờ bị ghi đè; implicit (hành vi) = ưu tiên mềm. Rule engine là mặc định; Groq chỉ gọi khi user bấm nút "Nhờ AI gợi ý" (prompt kèm taste tính sẵn). Không thêm vendor/key mới — toàn SQL + cron sẵn có.

- [x] **7A — Tìm kiếm mờ tiếng Việt** (02/10/2026): extension `pg_trgm`, cột `foods.search_norm` + trigger duy trì + index GIN (migration 011) — `GET /foods/search` chuẩn hóa query cùng quy tắc SQL/TS (map 67 ký tự, verify khớp 3 nơi), khớp chuỗi con trước + `similarity` vét sau, escape `%_`, test `search-norm.spec`
- [ ] **7B — Hồ sơ gu ngầm**: bảng `user_taste_profiles` (`liked/disliked_tags`, decay 90 ngày, cron đêm tính lại 1 lần) + hooks ở log bữa ăn / log tập / like / adherence xấu (migration 012); user mới <2 tuần → weight taste = 0 (chỉ dùng explicit)
- [ ] **7C — Gợi ý món bằng rule**: `GET /nutrition/suggest` — `score = macro_fit(goal) + taste − recently_eaten_penalty + adherence_boost`, trả kèm tag `source` để FE hiện "vì bạn hay ăn..."; nối luôn mục tồn Phase 3 "tự điều chỉnh plan" bằng adherence thực tế
- [ ] **7D — Gợi ý workout bằng rule**: bảng map `activity → nhóm cơ`, xoay nhóm cơ (hôm qua tay → nay chân/cardio) + tăng tải 5% khi giữ streak + ngày nghỉ sau 5 ngày liên tiếp; `GET /workout/suggest`
- [ ] **7E — Khai thác chat không-AI**: dictionary-NER dùng chính bảng `foods` (~600 tên) + enum `ActivityType` quét tin nhắn chat → đếm nhắc đến → nạp vào taste (không LLM)
- [ ] **7F — Feed community ngầm**: `POST /community/views` batch (impression thật) + bảng `community_post_views` / `community_author_scores` + ranking `0.35*recency + 0.25*popularity + 0.30*affinity + 0.10*content_match − skip/report_penalty` + exploration 10% chống filter bubble (migration 013); riêng tư tuyệt đối, không API hide/mute công khai

## Phase 8 — Vector/RAG (để dành, làm sau khi Phase 7 thiếu) 🆕

Đã kiểm chứng khả thi (02/10/2026): Groq có Embeddings API (`nomic-embed-text-v1_5`, 768 chiều, chung `GROQ_API_KEY`), Supabase bật được `pgvector` + HNSW. Chưa làm vì rule (Phase 7) đủ dùng.

- [ ] Migration pgvector + cột `foods.embedding` + backfill batch nền (có backoff, tránh 429) + `GET /foods/semantic-search` (filter cứng trước, vector rank sau)
- [ ] Gu vector user (trung bình trọng số embedding món đã log/like trừ dislike) → gợi ý "món mới hợp gu"
- [ ] Summarizer chat hàng tuần (Groq) → đối chiếu gu vector (phát hiện gu mới/gu đổi) + RAG vào suggest-menu/plan

## TODO để sau (không chặn release)

- [x] Thay `MAIL_PASS` bằng App Password Gmail mới (01/10/2026): SMTP verify OK — mail OTP (`forgot-password`/đăng ký) đã gửi được

## Đã xong (không làm lại)

- Auth cơ bản: register/login Google + email, refresh token, JWT
- Theo dõi: cân nặng, nước, bữa ăn, tập luyện, mục tiêu dinh dưỡng, thống kê ngày/tuần
- AI: analyze-food, suggest-menu/plan, chat + stream + retry + conversations
- Profile: CRUD, avatar upload + static serve, allergies, settings + locale, i18n vi/en, xóa tài khoản
- Hạ tầng: auto-migrate khi boot (`src/database/migrations`), backfill settings, khởi tạo setting mặc định khi tạo user
