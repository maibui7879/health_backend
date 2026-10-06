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
- [x] **Ảnh món ăn** (06/10/2026): `foods.image_url/image_credit` (migration 021) + seed 25 món phổ biến từ lead image vi.wikipedia (hotlink thumb, kèm attribution CC) — script `scripts/seed-food-images/` (mapping tay → fetch → review `pending.csv` → `--emit`), NULL thì FE fallback emoji
- [x] **Ảnh món ăn đợt 2** (06/10/2026): migration `022-food-images-2.sql` (+42 món: fallback bài viết liên quan, retry 429/timeout, guard `IS NULL`) — tổng ~67 món có ảnh, 10 món không bài/ảnh free để NULL
- [x] **Ảnh món ăn đợt 3 toàn catalog** (06/10/2026): quét 603 món (VFCT + món nấu + seed 007), migration `023-food-images-3.sql` (+140 món mới, loại 2 ảnh sai kiểm chứng tay: `Dứa`, `Bơ`) — tổng ~207 món có ảnh
- [x] **Admin + duyệt món user gửi** (06/10/2026): `users.role` (USER/ADMIN, migration 024) + `RolesGuard` (@Roles, đọc role tươi từ DB) + `food_submissions` — `POST /foods/submissions` (user gửi), `GET /foods/submissions/mine`, `[Admin] GET /foods/submissions/pending`, `POST /foods/submissions/:id/approve` (sinh foods `USER-*`/`user`, trùng tên 409) / `reject`
- [x] **Report kiểm duyệt chung** (06/10/2026): bảng `reports` (POST/COMMENT/USER/WORKOUT/EXERCISE_TEMPLATE/FOOD, category, PENDING/ACTIONED/DISMISSED, migration 025 + copy `community_reports` cũ) — `POST /reports`, `GET /reports/mine`, `[Admin] GET /admin/reports`, `POST /admin/reports/:id/review` (DISMISS/HIDE_POST/UNHIDE_POST/DELETE_COMMENT/BAN_USER/UNBAN_USER/DEACTIVATE_TEMPLATE); report bài cũ chuyển sang bảng chung (giữ auto-hide 3 + mute ngầm); BAN chặn login/refresh/Google + kill session ở strategy
- [x] **Trung tâm thông báo** (06/10/2026): bảng `notifications` (migration 026) + `GET /notifications` (lọc unread, paging), `GET /notifications/unread-count` (badge), `PATCH /:id/read`, `POST /read-all`; `notify()` lưu in-app theo locale user + push best-effort (dọn token chết); hook fire-and-forget: duyệt/từ chối món, xử lý tố cáo, huy hiệu streak, lịch nhắc đến giờ (kể cả user không push token, `push:false` để khỏi bắn trùng)
- [x] **BMI** (có sẵn): `src/users/bmi.ts` tính lúc đọc + phân loại WHO, trả trong `GET /users/me`
- [x] **Cảnh báo lệch TDEE/BMI** (có sẵn): `warnings[]` real-time trong dashboard (`OVER_BUDGET` ≥120%, `UNDER_BUDGET` ≤50%, `UNSAFE_MEAL`)
- [ ] **Tự điều chỉnh plan**: khi user nhiều ngày không theo (so `daily` vs target), gợi ý plan mới hoặc cảnh báo — hiện chỉ suggest tĩnh

## Phase 4 — Community (module mới) ✅ XONG (01/10/2026)

- [x] Bảng `posts`, `comments`, `reactions` + CRUD bài đăng: `community_posts`, `community_comments`, `community_reactions` (migration 009) + `GET /community/posts` (feed, ẩn bài bị report), `GET /community/posts/mine`, `GET/POST/PATCH/DELETE /community/posts[/:id]` — chỉ chủ bài được sửa/xóa (403/404), i18n vi/en
- [x] Tương tác + comment (phân quyền xóa/sửa của chủ bài): `GET/POST /community/posts/:id/comments`, `PATCH /community/comments/:id` (chỉ chủ comment), `DELETE` (chủ comment hoặc chủ bài), `POST/DELETE /community/posts/:id/like` (idempotent, `like_count`/`comment_count` atomic)
- [x] Chia sẻ thực đơn/đồ tập (link từ nutrition/workout sang post): `linked_type` (`NUTRITION_PLAN`/`WORKOUT`/`MEAL`) + `linked_id` + `linked_snapshot` (chụp lúc đăng, không lộ private), verify quyền sở hữu, feed trả `author{full_name,avatar_url}` + `viewer_has_liked`
- [x] Kiểm duyệt cơ bản (report/hide) nếu cần trước public: `POST /community/posts/:id/report` (chống self-report 400, chống trùng 409, bảng `community_reports`), đủ 3 report → `is_hidden=true` tự ẩn khỏi feed (chủ bài vẫn xem/sửa được, người ngoài 404)

## Phase 5 — Tập luyện nâng cao ✅ XONG (05/10/2026)

- [x] Media minh họa bài tập (migration 016): `media_url/media_type/media_viewed_at` trên `workouts` + `POST /workouts/:id/media` (upload jpg/png/webp/mp4/webm ≤50MB, tái dùng pattern `/users/avatar`, serve `/uploads/workouts/`) + `POST /workouts/:id/media-link` (YouTube) + `POST /workouts/:id/viewed` (idempotent) + tạo log kèm `media_url` ngoài; xóa log dọn file
- [x] Catalog bài mẫu seed trước prod (migration 017 + 019): `exercise_templates` (code bền `RUN-EASY-01`..., 6 ActivityType × 3 độ khó = 18 mẫu, `demo_video_url` NULL bổ sung sau, `ON CONFLICT (code) DO NOTHING`) + `GET /workouts/templates[/:code]` + `template_id` lúc log (neo activity theo template); 019 tách duration khỏi tên (tên chỉ mô tả động tác, thêm `default_duration_minutes`, log override tự do)
- [x] Streak riêng + mục tiêu + thưởng (migration 018): `GET /workouts/streak` (current/longest/today, ngày có media phải xem hết mới tính) + `POST/GET /workouts/goals[/current]` (7|14|30 ngày, 1 ACTIVE/user 409) + cron 1AM chốt COMPLETED (badge `STREAK_<N>`) / FAILED

## Phase 6 — Pháp lý (cần trước khi public store)

- [ ] Điều khoản sử dụng + chính sách bảo mật: endpoint trả nội dung versioned (`GET /legal/:type`)
- [ ] Ghi nhận user đồng ý điều khoản (`POST /legal/accept`) + chặn dùng app nếu chưa đồng ý (tùy policy)

## Phase 7 — Cá nhân hóa ngầm, 0 token (không gọi AI) 🆕

Nguyên tắc: explicit (dị ứng, mục tiêu, bệnh) = ràng buộc cứng, không bao giờ bị ghi đè; implicit (hành vi) = ưu tiên mềm. Rule engine là mặc định; Groq chỉ gọi khi user bấm nút "Nhờ AI gợi ý" (prompt kèm taste tính sẵn). Không thêm vendor/key mới — toàn SQL + cron sẵn có.

- [x] **7A — Tìm kiếm mờ tiếng Việt** (02/10/2026): extension `pg_trgm`, cột `foods.search_norm` + trigger duy trì + index GIN (migration 011) — `GET /foods/search` chuẩn hóa query cùng quy tắc SQL/TS (map 67 ký tự, verify khớp 3 nơi), khớp chuỗi con trước + `similarity` vét sau, escape `%_`, test `search-norm.spec`
- [x] **7B — Hồ sơ gu ngầm** (02/10/2026): module `src/insights/` (`InsightsService` + `user_taste_profiles`, migration 012) — tokenizer tag tiếng Việt không-AI, hooks fire-and-forget ở log bữa (`recordMeal`) / yêu thích ×2 (`recordFavorite`) / log tập (`recordWorkout`) / like bài (`recordCommunityLike` ×0.5) / plan OFF_TRACK (`recordPlanSkipped`), cron 3AM decay half-life 90 ngày + tỉa <0.05, `getProfile()` trả `weight` (0 khi <5 tín hiệu hoặc <14 ngày, ramp tới 30) + top tags/workouts cho 7C/7D/7F
- [x] **7C — Gợi ý món bằng rule** (02/10/2026): `SuggestService` + `GET /nutrition/suggest` (0 token) — `score = macro_fit(goal+diet: protein-forward + kcal-density + KETO carbs) + taste(gu ngầm × weight, cầu đồng nghĩa vi↔en từ catalog ×0.5) − 1.5 (ăn trong 3 ngày) + 1 (món trong plan ACTIVE mà thực sự đã ăn — nối mục tồn Phase 3)`; lọc cứng dị ứng + VEGAN; trả breakdown điểm + mã lý do (`taste_match/goal_fit/adherence_proven/variety`) để FE hiện "vì bạn hay ăn..."
- [x] **7D — Gợi ý workout bằng rule** (02/10/2026): `SuggestWorkoutService` + `GET /workouts/suggest` (0 token) — `score = rotation_fit (nhóm cơ tươi sau hôm qua, map activity→legs/cardio/upper/core/flexibility/full) + taste (workout_prefs × weight)`; tăng tải +5% làm tròn 5 phút (10–120) theo lịch sử từng môn; nghỉ ngơi (`rest: true`) lên đầu sau 5 ngày tập liên tiếp; mã lý do (`rotation_recovery/taste_match/progression/variety_new/recovery_streak`)
- [x] **7E — Khai thác chat không-AI** (02/10/2026): dictionary-NER trong `src/insights/chat-dictionary.ts` (từ điển món = chính catalog foods vi+en, alias activity vi+en, khớp biên từ để `cá`≠`các`) + `recordChatMention` (tag món ×0.3, workout_prefs ×0.3, cache từ điển 1h, bỏ qua tin không nhắc gì) — hook trong `saveMessage` nên phủ chat thường/stream/retry, không LLM
- [x] **7F — Feed community ngầm** (02/10/2026): `POST /community/views` batch + bảng `community_post_views` / `community_author_scores` (migration 013) — ranking `0.35*recency(exp/48h) + 0.25*popularity(ln likes+2*comments, chuẩn hóa) + 0.30*affinity + 0.10*content_match(gu 7B) − 0.5 skip (thấy ≥3 lần không tương tác)`; report −2 = mute ngầm author; like/comment +1; exploration mỗi ô thứ 10 cho bài chưa thấy; riêng tư tuyệt đối, không API hide/mute công khai

## Phase 8 — Vector/RAG ✅ XONG (02/10/2026)

- [x] pgvector + embeddings món ăn: migration 014 (`CREATE EXTENSION vector`, `foods.embedding vector(768)` + index HNSW, `chat_summary/_at` trong taste) + `EmbeddingsModule` global (`EmbeddingsService`: Groq `nomic-embed-text-v1_5`, batch 64, backoff 429 ×4) + script `scripts/backfill-food-embeddings.cjs` (batch 32, chạy tay, idempotent)
- [x] `GET /foods/semantic-search?q=&max_kcal=&limit=`: embed câu hỏi → cosine `<=>` + lọc kcal trong SQL, Groq lỗi → rớt về tìm từ khóa (`engine: vector|keyword`), trả `similarity`
- [x] Gu vector + món mới hợp gu: `GET /nutrition/discover` — trung bình embedding món đã thích/ăn (favorites + khớp tên log gần đây), loại món đã biết, cosine nearest; chưa đủ taste → `not_enough_data`, DB chưa backfill → `embeddings_pending` (0 token lúc request)
- [x] Summarizer chat hàng tuần + RAG: cron CN 4AM (`summarizeChats`, ≤50 user, ≤20 tin/user, ≤200 tokens, `NONE` thì bỏ) → `saveChatSummary` → `tasteContextBlock()` chèn vào prompt `suggest-menu/plan` (ưu tiên mềm, không ghi đè dị ứng/chế độ)

## TODO để sau (không chặn release)

- [x] Thay `MAIL_PASS` bằng App Password Gmail mới (01/10/2026): SMTP verify OK — mail OTP (`forgot-password`/đăng ký) đã gửi được

## Đã xong (không làm lại)

- Auth cơ bản: register/login Google + email, refresh token, JWT
- Theo dõi: cân nặng, nước, bữa ăn, tập luyện, mục tiêu dinh dưỡng, thống kê ngày/tuần
- AI: analyze-food, suggest-menu/plan, chat + stream + retry + conversations
- Profile: CRUD, avatar upload + static serve, allergies, settings + locale, i18n vi/en, xóa tài khoản
- Hạ tầng: auto-migrate khi boot (`src/database/migrations`), backfill settings, khởi tạo setting mặc định khi tạo user
