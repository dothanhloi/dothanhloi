# Cân Cà Phê – ứng dụng cân cà phê theo xe (iOS / Android)

Ứng dụng React Native (Expo) để cân cà phê tại kho: mỗi xe có nhiều **bảng cân 5 cột × 5 bao**, tổng từng cột, tổng xe, chất lượng (mẫu – tạp – độ), giá, thanh toán, bốc hàng, lịch sử chỉnh sửa (phải **nhấn giữ** mới sửa được), tài khoản nhân viên và đồng bộ lên **Google Sheets**.

Mã nguồn backend Google Sheets nằm trong `google-apps-script/Code.gs`.

---

## 1. Tính năng

| Yêu cầu | Cách dùng trong app |
|---|---|
| Giao diện bảng 5 cột, mỗi cột 5 số, tổng ở dưới | Mỗi xe mặc định 2 bảng (BẢNG 1, BẢNG 2), bấm **Thêm bảng** nếu cần. Bấm ô trống → bàn phím số → **Tiếp** để nhảy sang ô trống kế tiếp. |
| Tổng bao / Tổng thô / Trung bình | Hiện ở đầu màn hình xe, tự cập nhật. |
| Đã thanh toán / chưa thanh toán | Thẻ **Thanh toán**: sổ trả tiền nhiều lần (tiền mặt / chuyển khoản, ai ghi, lúc nào), trạng thái tự chuyển Chưa – Một phần – Đã, còn lại. |
| Người bán và công nợ | Mỗi xe gán **người bán** (thêm nhanh khi tạo xe). Màn hình **Công nợ** (icon ví ở trang chủ) tổng hợp còn nợ theo từng người, bấm vào trả tiền ngay. |
| Phiếu cân gửi Zalo | Trên xe bấm **Phiếu cân (PDF)** → chia sẻ qua Zalo, Messages hoặc lưu file. Phiếu khổ A5 có tên cơ sở (nhập ở Cài đặt), bảng từng bao, tạp độ, giá, thành tiền, đã trả, chỗ ký. |
| Giá tham chiếu theo ngày | Thanh **Giá tham chiếu** ở trang chủ: nhập một lần, xe tạo mới trong ngày tự lấy giá, vẫn sửa riêng từng xe. |
| Báo cáo | **Báo cáo** (lối tắt trang chủ): theo ngày / tuần / tháng / năm; nhóm theo ngày, người bán, nhân viên, tài xế, loại hàng, kho; **xuất Excel (.xlsx)** nhiều sheet. |
| Tồn kho, hedge | **Tồn kho**: nhập (thực nhận các xe) − xuất bán = tồn, theo từng kho. Ghi lệnh hedge (lot, tấn/lot) để thấy số tấn chưa hedge. |
| Loại hàng, kho | Cài đặt → Loại hàng (gắn quy ước tạp độ riêng, tự áp khi chọn), Cài đặt → Kho. Chọn khi tạo xe hoặc trên xe. |
| Ảnh | Trên xe: chụp / chọn ảnh mẫu hàng, phiếu cân giấy, xe hàng. Ảnh nén ~300 KB, lưu trong máy và tự tải lên Google Drive (thư mục "Cân Cà Phê - Ảnh") khi đã liên kết. |
| Tìm xe | Icon kính lúp: tìm theo người bán, tài xế, biển số, SĐT, ngày, ghi chú; lọc đang cân / đã xong / còn nợ / chưa bốc. |
| Phân quyền | Cài đặt → **Nhân viên thấy giá và tiền** (tắt: nhân viên chỉ thấy kg; giá, thành tiền, công nợ, phiếu cân bị ẩn). |
| Cân xe tải | Khi tạo xe hoặc trên xe chọn **Cân xe tải**: nhập cân xe vào (có hàng) và xe ra (rỗng), hàng = vào − ra, số bao nhập tay. |
| Bảo mật, sao lưu | PIN được băm SHA-256 (tài khoản cũ tự chuyển khi mở app). Sao lưu tự động mỗi ngày vào máy, giữ 7 bản. |
| Nhắc việc | Trang chủ: xe hôm trước chưa bấm xong, xe xong chưa có giá, chưa bốc, công nợ quá hạn N ngày (N đặt trong Cài đặt). |
| Chất lượng: mẫu (g), tạp, độ | Thẻ **Chất lượng & giá**: chọn **quy ước tạp độ**, nhập Mẫu (g), Tạp (g hoặc %), Độ (%) → app trừ theo quy ước → **Thực nhận**, **Giá sau trừ**. |
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

Các trang tự tạo trong Sheets: **Xe**, **Chi tiết cân**, **Thanh toán**, **Công nợ**, **Xuất bán**, **Tồn kho**, **Hedge**, **Ảnh**, **Lịch sử sửa**, **Người bán**, **Giá ngày**, **Kho**, **Loại hàng**, **Quy ước**, **Nhân viên**, **Tài xế**, **DATA** (dữ liệu gốc – không sửa tay). Ảnh được lưu vào thư mục Google Drive "Cân Cà Phê - Ảnh" của tài khoản chạy script.

Khi sửa `Code.gs`, vào **Triển khai → Quản lý triển khai → ✏️ → Phiên bản: Mới → Triển khai** thì link cũ mới chạy mã mới.

Bản mới có tải ảnh lên Google Drive nên khi dán lại mã, Google sẽ hỏi cấp thêm quyền Drive: bấm **Xem lại quyền** → cho phép, rồi mới tạo phiên bản triển khai mới.

Tuỳ chọn: trong trình soạn thảo Apps Script chọn hàm `setupTrigger` và bấm Chạy một lần. Các trang dễ đọc (Xe, Công nợ, Tồn kho...) sẽ được dựng lại mỗi 10 phút khi có thay đổi, ngoài việc tự dựng lại tối đa 2 phút một lần mỗi khi có máy đồng bộ.

Cách đồng bộ: mỗi máy gửi các bản ghi thay đổi, máy chủ ghi theo giờ nhận và trả về những gì máy đó chưa có. Xe được **gộp theo trường**: bản mới hơn thắng số cân và thông tin, còn sổ thanh toán và lịch sử sửa được hợp nhất từ cả hai máy nên không mất lần trả tiền ghi ở máy khác. Hai máy cùng tạo "Xe 3" khi mất mạng: xe tạo sau được đánh lại số và ghi lịch sử.

App tự đồng bộ 3 giây sau mỗi thay đổi khi có mạng; không có mạng vẫn cân bình thường, sẽ gửi khi có mạng lại. Dữ liệu gộp theo thời gian cập nhật nên nhiều máy cùng dùng không ghi đè lẫn nhau (trừ khi hai máy cùng sửa đúng một xe cùng lúc – máy sửa sau thắng).

---

## 5. Quy ước tạp độ và công thức tính

Tạp, độ được trừ theo **quy ước (preset)** chọn cho từng xe. Tạo và sửa quy ước trong **Cài đặt → Quy ước tạp độ** (có 4 mẫu sẵn: Trừ kg 1:1, Trừ giá, Bảng trừ lùi, Chỉ ghi nhận). Mỗi quy ước gồm:

| Phần | Tuỳ chọn |
|---|---|
| Cách nhập tạp | Gram trong mẫu (app tính % = tạp g / mẫu g) hoặc nhập % trực tiếp |
| Tạp, Độ (mỗi yếu tố riêng) | **Không trừ** · **Trừ kg**: mỗi 1% vượt chuẩn trừ R% khối lượng · **Trừ giá**: mỗi 1% vượt chuẩn trừ R đ/kg · **Bảng trừ lùi**: các bậc "đo ≤ X% → trừ Y" (Y theo % kg hoặc đ/kg) |
| Bì | Không trừ · kg mỗi bao · % tổng thô |

Xe lưu **bản sao** quy ước tại thời điểm chọn, nên sửa quy ước sau này không đổi số liệu xe cũ. Đổi quy ước trên xe được ghi vào lịch sử.

```
Tổng thô      = tổng tất cả các ô
Trừ bì        = số bao × bì/bao  (hoặc tổng thô × %)
Trừ tạp (kg)  / Trừ độ (kg)   theo quy ước (phương pháp Trừ kg hoặc Bảng % kg)
Thực nhận     = Tổng thô − trừ bì − trừ tạp − trừ độ
Giá sau trừ   = Giá − trừ tạp (đ/kg) − trừ độ (đ/kg)   (phương pháp Trừ giá hoặc Bảng đ/kg)
Thành tiền    = Thực nhận × Giá sau trừ
Còn lại       = Thành tiền − Đã thanh toán
```

## 6. Cấu trúc mã

```
src/app/            màn hình (Expo Router)
  _layout.tsx       khung + kiểm tra đăng nhập + tự đồng bộ
  login.tsx         chọn nhân viên + PIN (lần đầu: tạo tài khoản quản lý)
  index.tsx         danh sách xe theo ngày, tạo xe
  truck/[id].tsx    chi tiết xe: bảng cân, chất lượng, giá, thanh toán, xong xe
  history/[id].tsx  lịch sử sửa của xe
  settings/         nhân viên, người bán, tài xế, quy ước tạp độ, Google Sheets, thông tin phiếu, sao lưu
  debts/            công nợ theo người bán, chi tiết từng người
  reports/          báo cáo theo kỳ, nhóm, xuất Excel
  inventory/        tồn kho, xuất bán, hedge
  search/           tìm xe
src/components/     WeighTable (bảng 5×5), NumPad (bàn phím số), PaymentSheet, ui (thành phần chung)
src/lib/            store (zustand + AsyncStorage), calc, reports, receipt (phiếu PDF), xlsx, photos, backup, security, sync (Google), format, types
google-apps-script/ Code.gs – backend Google Sheets
```

Dữ liệu trên máy lưu bằng SQLite (expo-sqlite/kv-store), không bị giới hạn 6 MB như AsyncStorage trên Android; dữ liệu cũ tự chuyển sang khi mở app.

Lưu ý bảo mật: PIN được băm SHA-256 trước khi lưu và đồng bộ. Link Google Apps Script là "chìa khoá" vào dữ liệu, chỉ chia sẻ cho nhân viên.

Chưa làm: kết nối cân điện tử Bluetooth (cần biết model cân và bản build riêng ngoài Expo Go), thông báo đẩy (push). Nhắc việc hiện hiển thị trong app khi mở.
