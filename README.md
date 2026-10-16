# Cân Cà Phê – ứng dụng cân cà phê theo xe (iOS / Android)

Ứng dụng React Native (Expo) để cân cà phê tại kho: mỗi xe có nhiều **bảng cân 5 cột × 5 bao**, tổng từng cột, tổng xe, chất lượng (mẫu – tạp – độ), giá, thanh toán, bốc hàng, lịch sử chỉnh sửa (phải **nhấn giữ** mới sửa được), tài khoản nhân viên và đồng bộ lên **Google Sheets**.

Mã nguồn backend Google Sheets nằm trong `google-apps-script/Code.gs`.

---

## 1. Tính năng

| Yêu cầu | Cách dùng trong app |
|---|---|
| Giao diện bảng 5 cột, mỗi cột 5 số, tổng ở dưới | Mỗi xe mặc định 2 bảng (BẢNG 1, BẢNG 2), bấm **Thêm bảng** nếu cần. Bấm ô trống → bàn phím số → **Tiếp** để nhảy sang ô trống kế tiếp. |
| Tổng bao / Tổng thô / Trung bình | Hiện ở đầu màn hình xe, tự cập nhật. |
| Đã thanh toán / chưa thanh toán | Thẻ **Thanh toán**: Chưa – Một phần – Đã thanh toán, số tiền đã trả, còn lại. |
| Chất lượng: mẫu (g), tạp, độ | Thẻ **Chất lượng & giá**: Mẫu (g), Tạp (g) → tự tính % tạp, Độ (%), độ chuẩn, bì/bao → **Thực nhận**. |
| Giá cà phê | Nhập giá đ/kg → tự tính **Thành tiền** = thực nhận × giá. |
| Sửa phải nhấn giữ, lưu lịch sử | Ô đã có số hoặc trường đã điền: bấm thường chỉ báo “Nhấn giữ để sửa”. Nhấn giữ ~0,5 giây mới sửa. Mọi thay đổi ghi vào **Lịch sử sửa** (ai, lúc nào, cũ → mới). |
| Đã bốc / chưa bốc | Nút gạt **Chưa bốc / Đã bốc** trên xe, lưu giờ bốc. |
| Ngày tự hiện, liên kết các xe trong ngày | Màn hình chính theo ngày (mặc định hôm nay), mũi tên đổi ngày, dải ngày có xe. |
| Xe 1, 2, 3 cố định theo thứ tự | **Tạo xe** → số xe tự tăng trong ngày, không trùng kể cả khi xoá. Chọn tài xế (hoặc thêm mới ngay), chọn nhân viên đi cân. |
| Lưu giờ tạo xe | Giờ tạo + người tạo hiển thị trên xe và trong Google Sheets. |
| Nút “Xong xe” + tổng kết | Bấm **Xong xe** → xác nhận → bảng khoá, hiện thẻ tổng kết (bao, thô, tạp, độ, thực nhận, giá, thành tiền, đã TT, còn lại). Nhấn giữ để mở lại. |
| Lưu trên Google | **Cài đặt → Liên kết Google Sheets** (xem mục 4). |
| Tài khoản nhiều nhân viên | **Cài đặt → Nhân viên**: tên + PIN 4 số, vai trò Quản lý / Nhân viên. Tên nhân viên đi cân hiện trên từng xe. |

---

## 2. Chạy thử trên điện thoại (không cần Mac)

```bash
npm install
npx expo start
```

Cài app **Expo Go** trên iPhone, quét mã QR trong terminal. Mọi thư viện dùng trong dự án đều có sẵn trong Expo Go.

Kiểm tra mã:

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # expo lint
```

---

## 3. Đưa lên App Store (không cần Mac, dùng EAS của Expo)

### 3.1 Chuẩn bị (làm 1 lần)
1. **Apple Developer Program** – đăng ký tại <https://developer.apple.com/programs/enroll/> (99 USD/năm, duyệt 1–2 ngày). Dùng Apple ID của bạn, chọn loại cá nhân (Individual) hoặc doanh nghiệp (Organization – cần mã D-U-N-S).
2. **Tài khoản Expo** – tạo miễn phí tại <https://expo.dev/signup>.
3. Trên máy tính (Windows/Mac/Linux đều được): cài Node.js 20+, rồi:
   ```bash
   npm install
   npx eas-cli@latest login
   npx eas-cli@latest init        # liên kết dự án với tài khoản Expo (tạo projectId)
   ```
4. Nếu thư mục `assets/` chưa có file PNG (icon.png, splash-icon.png, android-icon-*.png, favicon.png), tạo bằng: `pip install pillow && python3 scripts/make-icons.py assets`.
5. Mở `app.json`, đổi nếu muốn:
   - `ios.bundleIdentifier` (hiện là `com.thanhloi.cancaphe`) – phải duy nhất trên App Store.
   - `name` – tên hiển thị dưới icon.

### 3.2 Build file iOS trên cloud
```bash
npx eas-cli@latest build --platform ios --profile production
```
Lần đầu EAS sẽ hỏi đăng nhập Apple ID và **tự tạo** chứng chỉ, provisioning profile và app trên App Store Connect. Chờ 10–20 phút, build xong sẽ có link tải `.ipa`.

### 3.3 Nộp lên App Store Connect
```bash
npx eas-cli@latest submit --platform ios --latest
```
Hoặc chạy gộp: `npx eas-cli@latest build --platform ios --profile production --auto-submit`.

### 3.4 Thử nghiệm bằng TestFlight (khuyên dùng trước khi phát hành)
Sau khi submit, vào <https://appstoreconnect.apple.com> → ứng dụng → **TestFlight** → thêm email nhân viên vào nhóm thử nghiệm nội bộ. Họ cài app TestFlight trên iPhone và nhận bản cài ngay, không cần qua kiểm duyệt.

### 3.5 Phát hành lên App Store
Trong App Store Connect → **App Store** tab:
- Ảnh chụp màn hình iPhone 6.7" (ít nhất 1–3 ảnh; chụp trực tiếp từ TestFlight).
- Mô tả, từ khoá, danh mục (Business), độ tuổi.
- **URL chính sách quyền riêng tư**: dùng file `PRIVACY.md` của repo này, ví dụ `https://github.com/dothanhloi/dothanhloi/blob/main/PRIVACY.md`.
- **App Privacy**: chọn “Data Not Collected” (app không gửi dữ liệu về nhà phát triển).
- Chọn build vừa nộp → **Submit for Review**. Apple duyệt thường 1–2 ngày.

Vì app dùng đăng nhập nội bộ, trong mục *App Review Information* hãy ghi chú cho Apple: “Lần đầu mở app sẽ tự tạo tài khoản quản lý, không cần tài khoản sẵn có”.

### 3.6 Cập nhật về sau
- Sửa code JS → `npx eas-cli@latest update --branch production --message "..."` phát bản cập nhật tức thì (OTA) không cần nộp lại.
- Thêm thư viện native hoặc đổi `app.json` → build lại (`eas build`) và nộp lại (`eas submit`). `autoIncrement` trong `eas.json` tự tăng số build.

### 3.7 Android (tuỳ chọn)
```bash
npx eas-cli@latest build --platform android --profile production
npx eas-cli@latest submit --platform android --latest
```
Cần tài khoản Google Play Console (25 USD một lần).

---

## 4. Liên kết Google Sheets

Làm 1 lần trên tài khoản Google của bạn:

1. Tạo Google Sheets mới: <https://sheets.new>.
2. Menu **Tiện ích mở rộng → Apps Script**. Xoá nội dung mặc định, dán toàn bộ file [`google-apps-script/Code.gs`](google-apps-script/Code.gs), bấm **Lưu** (Ctrl+S).
3. **Triển khai → Tuỳ chọn triển khai mới** → biểu tượng bánh răng chọn **Ứng dụng web**:
   - Thực thi với tư cách: **Tôi**
   - Ai có quyền truy cập: **Bất kỳ ai**
   - Bấm **Triển khai**, cấp quyền (chọn tài khoản → Nâng cao → Đi tới … (không an toàn) → Cho phép).
4. Sao chép **URL ứng dụng web** (dạng `https://script.google.com/macros/s/AKfyc…/exec`).
5. Trong app: **Cài đặt → Liên kết Google Sheets** → dán link → **Lưu & kiểm tra kết nối**.
6. Dán cùng link trên điện thoại của mọi nhân viên để dùng chung dữ liệu (nhân viên, tài xế, xe đều được đồng bộ).

Các trang tự tạo trong Sheets: **Xe** (tổng kết từng xe), **Chi tiết cân** (từng bao), **Lịch sử sửa**, **Nhân viên**, **Tài xế**, **DATA** (dữ liệu gốc – không sửa tay).

Khi sửa `Code.gs`, vào **Triển khai → Quản lý triển khai → ✏️ → Phiên bản: Mới → Triển khai** thì link cũ mới chạy mã mới.

App tự đồng bộ 3 giây sau mỗi thay đổi khi có mạng; không có mạng vẫn cân bình thường, sẽ gửi khi có mạng lại. Dữ liệu gộp theo thời gian cập nhật nên nhiều máy cùng dùng không ghi đè lẫn nhau (trừ khi hai máy cùng sửa đúng một xe cùng lúc – máy sửa sau thắng).

---

## 5. Công thức tính

```
Tổng thô      = tổng tất cả các ô
Tạp %         = Tạp (g) / Mẫu (g) × 100
Trừ tạp (kg)  = Tổng thô × Tạp %
Trừ độ (kg)   = Tổng thô × max(0, Độ − Độ chuẩn) %
Trừ bì (kg)   = Số bao × Bì/bao
Thực nhận     = Tổng thô − trừ bì − trừ tạp − trừ độ
Thành tiền    = Thực nhận × Giá
Còn lại       = Thành tiền − Đã thanh toán
```
Độ chuẩn và bì/bao mặc định chỉnh trong **Cài đặt** (áp dụng cho xe tạo mới; mỗi xe vẫn sửa riêng được).

---

## 6. Cấu trúc mã

```
src/app/            màn hình (Expo Router)
  _layout.tsx       khung + kiểm tra đăng nhập + tự đồng bộ
  login.tsx         chọn nhân viên + PIN (lần đầu: tạo tài khoản quản lý)
  index.tsx         danh sách xe theo ngày, tạo xe
  truck/[id].tsx    chi tiết xe: bảng cân, chất lượng, giá, thanh toán, xong xe
  history/[id].tsx  lịch sử sửa của xe
  settings/         nhân viên, tài xế, Google Sheets, mặc định, sao lưu
src/components/     WeighTable (bảng 5×5), NumPad (bàn phím số), ui (thành phần chung)
src/lib/            store (zustand + AsyncStorage), calc, sync (Google), format, types
google-apps-script/ Code.gs – backend Google Sheets
```

Lưu ý bảo mật: PIN được lưu dạng chữ thường trên máy và Google Sheets của bạn (app nội bộ). Không dùng PIN trùng mật khẩu quan trọng.
