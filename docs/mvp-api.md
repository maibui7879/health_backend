# Backend MVP theo sheet Trang tính3

Mọi API trừ `GET /legal` yêu cầu access token, theo envelope hiện tại `{ success, message, data }`.
Migration `027-mvp-health.sql` tự chạy khi backend khởi động; phải deploy cả migration và mã mới.

## Hồ sơ và Home

`PUT /users/profile` nhận thêm:

```json
{
  "blood_type": "UNKNOWN",
  "occupation": "Nhân viên văn phòng",
  "activity_habits": "Đi bộ buổi chiều",
  "medical_conditions": [],
  "hydration_restricted": false,
  "enabled_modules": ["water", "nutrition", "workout"],
  "bmr_formula": "MIFFLIN_ST_JEOR"
}
```

Công thức: `MIFFLIN_ST_JEOR`, `HARRIS_BENEDICT`, `ROZA_SHIZGAL`.
BMI, BMR, TDEE và calo mục tiêu là các chỉ số riêng. Thiếu thông tin trả null cho phần chưa tính được.
Nước chỉ cần cân nặng; mức vận động điều chỉnh hệ số ước tính. `hydration_restricted=true` tắt mục tiêu nước tự động.
Các phương trình năng lượng chỉ tính cho người trưởng thành có giới tính sinh học MALE/FEMALE trong dữ liệu.
Không suy ra bệnh lý từ nhóm máu. Lịch sử chỉ số được lưu bằng trigger khi hồ sơ thay đổi.

`PUT /users/settings` nhận thêm `show_water`, `show_calories`, `show_workout`,
`water_start_time` (mặc định `11:00`), `water_end_time` (mặc định `20:30`).
`water_interval_mins` từ 15 đến 1440. `meal_times` có các khóa `breakfast`, `lunch`, `dinner`, giá trị HH:mm.

| API | Công dụng |
| --- | --- |
| GET /wellness/onboarding | Module đã chọn, trường còn thiếu theo module, chỉ số tính được |
| GET /wellness/home?date=YYYY-MM-DD | Tiến độ, bữa ăn, bài tập, lịch nhắc và trạng thái widget |
| GET /wellness/measurements?from=YYYY-MM-DD&to=YYYY-MM-DD | Lịch sử chỉ số và thời điểm ghi nhận |
| GET /wellness/stats?from=YYYY-MM-DD&to=YYYY-MM-DD | Chuỗi ngày gồm cả ngày trống, cân nặng/BMI, calo, TDEE, nước |

Khoảng ngày mặc định là 7 ngày gần nhất, tối đa 366 ngày. Trước khi có snapshot lịch sử, chỉ số lịch sử có thể null;
không dựng dữ liệu cũ từ hồ sơ hiện tại. Snapshot đầu tiên của người dùng cũ được tạo ở thời điểm migration.

## Nước và streak

```http
POST /wellness/water
Content-Type: application/json

{"volume_ml":250,"beverage_type":"WATER","date":"2026-11-14"}
```

Các loại: WATER (1), SOUP (0.95), MILK (0.9), TEA (0.9), COFFEE (0.8), ALCOHOL (0).
Đây là **hệ số sản phẩm ước tính theo bản mô tả**, chưa phải chuẩn y khoa; response có `coefficient_is_estimate=true`.
`date` bỏ trống lấy ngày Việt Nam. Không ghi ngày tương lai.
`GET /wellness/water?date=...` liệt kê từng lần uống; `DELETE /wellness/water/:id` trừ lượng nước hiệu dụng của bản ghi.
Thêm/xóa dùng transaction và khóa theo người dùng để không mất lượng nước khi gửi đồng thời.
`GET /wellness/water/streak` trả `current_days`, `longest_days`, `today_done`.
Streak chỉ tính khi đạt mục tiêu ngày đó. Sang ngày mới không xóa dữ liệu cũ: đọc ngày chưa có log sẽ trả 0 ml.

API tracking cũ vẫn nhận tổng nước tuyệt đối; mobile nên dùng API water cho các nút +250 ml.
Không trộn thao tác ghi đè tổng nước cũ với giao diện quản lý từng lần uống.

## Calo và sửa bữa

`PATCH /nutrition/meals/:id` nhận `meal_type` và/hoặc toàn bộ `items`, cùng cấu trúc với POST meals.
Không đổi ngày của bữa. Khi truyền items, danh sách mới thay danh sách cũ.
Tổng calo được suy ra từ các bữa/bài tập bằng trigger và đồng bộ sang tracking.
`total_kcal_in/out` trong tracking là trường tương thích, giá trị client gửi không còn là nguồn dữ liệu.
Ghi cân nặng tracking ngày cũ được lưu lịch sử, không thay cân nặng hiện tại trong profile.
Streak tập tính khi có ít nhất một bài hoàn thành, không buộc xem hết media.

## Nhắc nhở và timezone

Ngày thống kê, reset nước và streak theo Asia/Ho_Chi_Minh.
Lịch tự động từ settings dùng giờ Việt Nam, kiểm tra tiến độ nước 25% trước 14h, 40% từ 14h, 75% từ 19h;
chỉ gửi tại mốc giãn cách trong khung giờ đã chọn. Đạt mục tiêu hoặc có hạn chế nước sẽ không gửi.
Lịch tự động có khóa chống gửi trùng giữa nhiều instance. Nếu đã tạo lịch WATER/MEAL thủ công,
lịch tự động cùng loại nhường cho lịch thủ công để tránh hai cơ chế gửi cùng lúc.
API `/reminders` cũ giữ hợp đồng giờ UTC, FE phải chuyển cả giờ và ngày trong tuần sang UTC.
Lịch WATER thủ công vẫn kiểm tra tiến độ/khung giờ Việt Nam trước khi gửi.

FCM và Expo token đều được hỗ trợ. Với FCM cấu hình `FIREBASE_SERVICE_ACCOUNT_JSON` chứa service account
có quyền gửi Firebase Cloud Messaging. Không đưa key này vào ứng dụng mobile hoặc commit.
Chưa kiểm chứng gửi push thật nếu chưa cấu hình credentials.

## Thực đơn dự phòng và pháp lý

`GET /wellness/menu-templates` trả các mức 1500/1800/2000 theo chế độ ăn.
`POST /ai/suggest-menu` và `/ai/suggest-plan` tự trả mẫu khi AI lỗi, có `source=STATIC_FALLBACK`, `requires_review=true`.
Macro/khẩu phần là ước tính demo. Với dị ứng chưa xác minh, trả danh sách món rỗng và lý do cần kiểm tra.

`GET /legal` trả phiên bản, điều khoản, chính sách và miễn trừ y tế cho MVP.
`GET /wellness/consent` kiểm tra phiên bản đã đồng ý.
`POST /wellness/consent` nhận `{"version":"2026-11-14","accepted":true}`, lưu thời điểm trên server.
Mobile cần hiển thị nội dung và gọi xác nhận sau thao tác người dùng.

`POST /auth/logout` thu hồi tất cả token của tài khoản và xóa push token.
Đổi/quên mật khẩu cũng thu hồi token cũ; sau đổi mật khẩu cần đăng nhập lại.
Bật `REQUIRE_REGISTRATION_OTP=true` để chặn đăng ký trực tiếp; mặc định giữ đường cũ tương thích mobile.
Mobile chuyển sang `/auth/register/request-otp` rồi `/auth/register/verify-otp` trước khi bật cờ này.

## Kiểm tra

```sh
npm test -- --runInBand
npm run build
node scripts/prepare-mvp-verification.cjs
psql -v ON_ERROR_STOP=1 -f .cache/mvp-verification.sql
```

SQL kiểm tra tạo schema riêng trong transaction rồi rollback, bao gồm chạy migration hai lần,
calo không bị ghi đè, thêm/xóa bữa và bài tập, streak nước, lịch sử cân nặng và consent idempotent.

Tham khảo phương trình: [Mifflin–St Jeor](https://pubmed.ncbi.nlm.nih.gov/2305711/),
[Roza–Shizgal](https://pubmed.ncbi.nlm.nih.gov/6741850/).
