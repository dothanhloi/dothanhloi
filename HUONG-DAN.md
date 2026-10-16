# Hướng dẫn đưa app Cân Cà Phê lên App Store và sử dụng

## PHẦN A. Chuẩn bị tài khoản (làm 1 lần, 1–3 ngày chờ duyệt)

### A1. Apple Developer Program (99 USD/năm)
1. Trên iPhone, cài app **Apple Developer** từ App Store.
2. Mở app → tab **Account** → đăng nhập Apple ID của bạn (bật xác thực 2 lớp trước, trong Cài đặt → Apple ID → Mật khẩu & Bảo mật).
3. Bấm **Enroll Now** → chọn **Individual / Sole Proprietor** (cá nhân, duyệt nhanh nhất). Chụp CCCD khi được yêu cầu, điền họ tên đúng như trên giấy tờ (không dấu cũng được).
4. Thanh toán 99 USD bằng thẻ Visa/Mastercard. Apple gửi email xác nhận trong 1–2 ngày (đôi khi tới 1 tuần).
5. Khi vào được https://appstoreconnect.apple.com bằng Apple ID này là xong.

### A2. Tài khoản Expo (miễn phí)
1. Vào https://expo.dev/signup, đăng ký bằng email.
2. Xác nhận email. Gói Free đủ dùng (30 lần build/tháng).

### A3. Máy tính
Windows hoặc Mac đều được, chỉ cần:
1. Cài **Node.js** bản LTS: https://nodejs.org (bấm Next liên tục).
2. Cài **Git**: https://git-scm.com/downloads.
3. Mở **PowerShell** (Windows) hoặc **Terminal** (Mac) để gõ lệnh ở các bước sau.

---

## PHẦN B. Tải mã nguồn và chạy thử trên iPhone (15 phút)

```bash
git clone -b claude/coffee-weighing-app-5632mk https://github.com/dothanhloi/dothanhloi.git can-ca-phe
cd can-ca-phe
npm install
npx expo start
```

1. Trên iPhone cài app **Expo Go** (miễn phí trên App Store).
2. iPhone và máy tính cùng Wi-Fi. Mở Camera iPhone quét mã QR trong cửa sổ lệnh → mở bằng Expo Go.
3. Nếu khác mạng: dừng (Ctrl+C) rồi chạy `npx expo start --tunnel`.
4. App chạy: tạo tài khoản quản lý → tạo xe → nhập thử vài số cân → bấm Xong xe → thử Phiếu cân PDF.

Mỗi lần tôi cập nhật mã, bạn chỉ cần `git pull` rồi `npm install` và chạy lại.

---

## PHẦN C. Thiết lập Google Sheets (làm 1 lần, 10 phút)

1. Đăng nhập Google của bạn, mở https://sheets.new → đặt tên, ví dụ "Cân Cà Phê 2026".
2. Menu **Tiện ích mở rộng → Apps Script**.
3. Xoá hết nội dung mặc định. Mở file `google-apps-script/Code.gs` trong thư mục mã nguồn (hoặc trên GitHub), copy toàn bộ, dán vào. Bấm biểu tượng **Lưu** (Ctrl+S).
4. Bấm **Triển khai → Tùy chọn triển khai mới**:
   - Bấm bánh răng cạnh "Chọn loại" → **Ứng dụng web**.
   - Mô tả: tuỳ ý. **Thực thi với tư cách: Tôi**. **Ai có quyền truy cập: Bất kỳ ai**.
   - Bấm **Triển khai** → **Cho phép truy cập** → chọn tài khoản → nếu hiện "Google chưa xác minh ứng dụng này": bấm **Nâng cao → Đi tới … (không an toàn) → Cho phép**.
5. Copy **URL ứng dụng web** (dạng `https://script.google.com/macros/s/AKfyc…/exec`). Đây là "chìa khoá" dữ liệu, chỉ đưa cho nhân viên.
6. (Khuyên dùng) Trong trình soạn thảo, chọn hàm `setupTrigger` ở thanh trên → bấm **Chạy** → cho phép. Các trang dễ đọc trong Sheets sẽ tự cập nhật mỗi 10 phút.
7. Trong app: **Cài đặt → Liên kết Google Sheets** → dán URL → **Lưu & kiểm tra kết nối**.

Mỗi lần tôi sửa `Code.gs`: dán lại nội dung mới → **Triển khai → Quản lý triển khai → biểu tượng bút chì → Phiên bản: Mới → Triển khai**. URL giữ nguyên, không cần đổi trong app.

---

## PHẦN D. Build và nộp lên App Store (lần đầu 30–60 phút, chủ yếu là chờ)

Thực hiện trong thư mục `can-ca-phe` ở Phần B.

### D1. Liên kết dự án với Expo
```bash
npx eas-cli@latest login
npx eas-cli@latest init
```
`init` hỏi "Would you like to create a project?" → **Y**. Nó ghi `projectId` vào `app.json`.

### D2. Bật cập nhật tức thì (OTA)
```bash
npx eas-cli@latest update:configure
```
Chọn Y khi được hỏi. Về sau sửa giao diện không cần nộp lại Apple.

### D3. Kiểm tra app.json
Mở `app.json`, mục `ios.bundleIdentifier` đang là `com.thanhloi.cancaphe`. Nếu EAS báo bị trùng, đổi thành ví dụ `com.thanhloiagrihub.cancaphe`.

### D4. Build iOS và tự nộp lên Apple
```bash
npx eas-cli@latest build --platform ios --profile production --auto-submit
```
Lần đầu EAS hỏi lần lượt, trả lời như sau:
- "Do you want to log in to your Apple account?" → **Y** → nhập Apple ID + mật khẩu + mã 6 số xác thực 2 lớp.
- "Generate a new Apple Distribution Certificate?" → **Y**.
- "Generate a new Apple Provisioning Profile?" → **Y**.
- Tạo app trên App Store Connect → **Y**, tên app: **Cân Cà Phê**.
- "Set up EAS Submit?" / "Submit to App Store?" → **Y**.

Chờ 10–25 phút. Theo dõi tại https://expo.dev (mục Builds). Xong, bản build tự được tải lên App Store Connect.

Nếu bước nộp lỗi, chạy riêng: `npx eas-cli@latest submit --platform ios --latest`.

### D5. Thử bằng TestFlight (khuyên dùng, không cần Apple duyệt)
1. Vào https://appstoreconnect.apple.com → **Ứng dụng của tôi → Cân Cà Phê → tab TestFlight**.
2. Chờ bản build hiện trạng thái **Ready to Test** (10–30 phút Apple xử lý). Nếu hỏi "Export Compliance": chọn **No** (app không dùng mã hoá đặc biệt, đã khai trong app.json).
3. Mục **Internal Testing** → **+** tạo nhóm "Nhân viên" → **Add Testers** → nhập Apple ID (email) của bạn và từng nhân viên.
4. Mỗi người cài app **TestFlight** trên iPhone, mở email mời, bấm **Install**. Có bản mới, TestFlight tự báo.

Với 1 cơ sở, dùng TestFlight nội bộ là đủ: tối đa 100 người, không cần qua kiểm duyệt. Bản TestFlight hết hạn sau 90 ngày, chạy lại lệnh D4 là có bản mới.

### D6. Phát hành công khai lên App Store (tuỳ chọn)
1. App Store Connect → **Cân Cà Phê → tab App Store → 1.0 Prepare for Submission**.
2. Điền:
   - **Ảnh chụp màn hình** iPhone 6.7": chụp 3–5 ảnh trên iPhone 15/16 Pro Max từ bản TestFlight (trang chủ, bảng cân, phiếu cân, báo cáo). Nếu chỉ có iPhone nhỏ hơn, Apple vẫn chấp nhận ảnh 6.5"/6.1" ở mục tương ứng.
   - **Mô tả** (gợi ý): "Ứng dụng cân và ghi nhận cà phê theo xe cho cơ sở thu mua: bảng cân từng bao, quy ước tạp độ, công nợ, phiếu cân PDF, báo cáo, đồng bộ Google Sheets cho nhiều nhân viên."
   - **Từ khoá**: cân cà phê, thu mua, nông sản, công nợ.
   - **Danh mục**: Business. **Độ tuổi**: 4+. **Giá**: Free.
   - **Privacy Policy URL**: `https://github.com/dothanhloi/dothanhloi/blob/claude/coffee-weighing-app-5632mk/PRIVACY.md`
   - **App Privacy** → **Get Started** → chọn **No, we do not collect data from this app**.
3. **App Review Information** → Notes, ghi: "Internal business app for a coffee buying station. On first launch the app creates an admin account locally; no existing credentials are needed. Google Sheets link is optional."
4. Chọn build → **Add for Review → Submit to App Review**. Apple duyệt 1–3 ngày. Nếu bị từ chối, copy nguyên văn lý do gửi tôi.

### D7. Cập nhật về sau
- Sửa giao diện, logic (chỉ JavaScript): `npx eas-cli@latest update --branch production --message "mô tả"`. Người dùng mở lại app 2 lần là có bản mới.
- Thêm thư viện mới hoặc đổi app.json: chạy lại D4 (số build tự tăng), rồi TestFlight/App Store như cũ.

### D8. Android (tuỳ chọn, 25 USD một lần)
```bash
npx eas-cli@latest build --platform android --profile production
npx eas-cli@latest submit --platform android --latest
```
Cần tài khoản Google Play Console. Hoặc build file APK để cài trực tiếp: `npx eas-cli@latest build --platform android --profile preview`.

---

## PHẦN E. Sử dụng app hằng ngày

### E1. Máy quản lý (lần đầu)
1. Mở app → **Tạo tài khoản quản lý** (tên + PIN 4 số).
2. **Cài đặt → Liên kết Google Sheets** → dán URL (Phần C).
3. **Cài đặt → Thông tin trên phiếu cân**: tên cơ sở, địa chỉ, SĐT.
4. **Cài đặt → Quy ước tạp độ**: xem quy ước mặc định "Trừ kg 1:1", sửa số liệu theo thoả thuận của kho, tạo thêm quy ước khác nếu cần (trừ giá, bảng trừ lùi...).
5. **Cài đặt → Nhân viên**: thêm từng nhân viên (tên + PIN, vai trò Nhân viên). **Tài xế**, **Người bán**, **Loại hàng**, **Kho** thêm dần khi dùng.
6. **Cài đặt → Phân quyền**: tắt "Nhân viên thấy giá và tiền" nếu không muốn nhân viên thấy tiền.

### E2. Máy nhân viên (lần đầu)
1. Cài app (TestFlight hoặc App Store) → mở → bấm **Máy phụ? Liên kết Google Sheets có sẵn** → dán URL do quản lý gửi (qua Zalo).
2. App tải danh sách nhân viên về → chọn tên → nhập PIN.

### E3. Quy trình một xe hàng
1. Trang chủ đúng ngày (mặc định hôm nay). Nhập **Giá tham chiếu** trong ngày nếu có (quản lý).
2. Bấm **Tạo xe N** → chọn chủ hàng (chọn nhiều người nếu xe chở hàng của nhiều chủ, hoặc gõ tên mới), tài xế, loại hàng, kho, nhân viên cân, kiểu cân (từng bao hoặc cân xe tải) → **Tạo**.
3. Mỗi chủ hàng là một khối riêng trên màn hình xe (CH 1, CH 2...) với bảng cân, tạp độ, giá, thanh toán và phiếu cân riêng. Bấm **Thêm chủ hàng** nếu phát sinh. Bấm ô trống → gõ số kg → **Tiếp** để sang ô kế tiếp. Hết 25 ô, bấm **Thêm bảng**.
4. Sai số: **nhấn giữ** ô để sửa (mọi lần sửa đều ghi lịch sử).
5. Với từng chủ hàng: nhập **Mẫu (g), Tạp (g), Độ (%)**, **Giá**. App tính thực nhận, thành tiền riêng cho mỗi người.
6. Chụp ảnh mẫu, phiếu giấy nếu muốn (+ Chụp).
7. Bấm **Xong xe** → xác nhận. Bảng bị khoá; muốn sửa, nhấn giữ "Đã xong" để mở lại.
8. Bấm **Phiếu cân (PDF)** trong khối của chủ hàng → gửi Zalo cho đúng người. Icon chia sẻ trên đầu màn hình xuất phiếu của cả xe (mỗi chủ hàng một trang).
9. Trả tiền: **Ghi thanh toán** trong khối của chủ hàng (có thể nhiều lần, tiền mặt/chuyển khoản). Xem tổng nợ theo từng người ở **Công nợ**.
10. Bốc hàng xong: gạt **Đã bốc**.

### E3b. Bán hàng
1. Trang chủ bấm tab **Bán hàng** → **Tạo chuyến bán N** → chọn khách hàng (có thể nhiều khách), tài xế, loại hàng, **kho xuất**, nhân viên giao, kiểu cân.
2. Cân như xe thu mua: bảng từng bao hoặc cân xe tải. Nhập tạp, độ theo thoả thuận với khách (chọn quy ước phù hợp), **giá bán**.
3. **Xong xe** → **Phiếu giao hàng (PDF)** gửi khách. Khách trả tiền: **Ghi thu tiền** (nhiều lần). Khách còn nợ xem ở **Công nợ → Phải thu**.
4. Tồn kho tự trừ phần đã bán. Báo cáo chọn **Bán hàng** hoặc **Cả hai** để thấy mua vào – bán ra và chênh lệch giá bình quân.
5. Khách hàng quản lý ở **Cài đặt → Khách hàng**. Một đối tác vừa bán vừa mua thì đặt vai trò **Cả hai**.

### E4. Theo dõi
- **Báo cáo**: theo ngày/tuần/tháng, theo người bán/nhân viên/tài xế/loại hàng; **Xuất Excel**.
- **Tồn kho**: ghi xuất bán, xem tồn từng kho; ghi lệnh hedge để thấy tấn chưa hedge.
- **Tìm xe**: kính lúp trên trang chủ.
- **Google Sheets**: mở trên máy tính để xem các trang Xe, Chi tiết cân, Công nợ, Thanh toán, Lịch sử sửa...
- **Sao lưu**: app tự sao lưu mỗi ngày trong máy. Thỉnh thoảng **Cài đặt → Sao lưu ra file** gửi về Zalo/Email của bạn.

### E5. Không có mạng
Vẫn cân bình thường. Khi có mạng lại, app tự đồng bộ (icon đám mây trên trang chủ). Hai máy cùng sửa một xe thì số cân lấy bản mới hơn, còn các lần trả tiền và lịch sử của cả hai máy đều được giữ.

---

## Khi gặp lỗi
Chụp màn hình lỗi (hoặc copy nguyên văn dòng lỗi trong cửa sổ lệnh) và gửi cho tôi kèm bước đang làm.
