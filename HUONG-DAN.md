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

### E1. Lần đầu trên máy quản lý (10 phút)
1. Mở app → **Tạo tài khoản quản lý**: nhập tên, PIN 4 số, nhập lại PIN → **Tạo tài khoản & bắt đầu**.
2. **Cài đặt** (bánh răng góc phải) → **Liên kết Google Sheets** → dán URL Apps Script (Phần C) → **Lưu & kiểm tra kết nối**. Thấy "Kết nối OK" là xong.
3. **Cài đặt → Thông tin trên phiếu cân**: tên cơ sở, địa chỉ, SĐT, dòng cuối phiếu (ví dụ số tài khoản). In trên mọi phiếu.
4. **Cài đặt → Quy ước tạp độ**: app có sẵn "Trừ kg 1:1" (tạp chuẩn 1%, độ chuẩn 13%, vượt 1% trừ 1% kg). Bấm bút chì để sửa số theo kho của bạn, hoặc **+** để tạo thêm quy ước khác (trừ giá, bảng trừ lùi, chỉ ghi nhận). Đánh dấu một quy ước là **mặc định**.
5. **Cài đặt → Nhân viên** → **+** → tên, PIN, vai trò *Nhân viên*. Mỗi người một tài khoản để biết ai cân xe nào.
6. **Cài đặt → Kho**: tạo nếu có từ 2 kho trở lên. **Loại hàng**: ví dụ "Robusta nhân xô", "Cà phê tươi" (có thể gắn quy ước riêng cho từng loại).
7. **Cài đặt → Phân quyền**: tắt **Nhân viên thấy giá và tiền** nếu không muốn nhân viên thấy giá, thành tiền, công nợ. Đặt **số ngày nhắc công nợ quá hạn**.

### E2. Lần đầu trên máy nhân viên (2 phút)
1. Mở app → bấm **Máy phụ? Liên kết Google Sheets có sẵn**.
2. Dán URL Apps Script (quản lý gửi qua Zalo) → **Liên kết & tải dữ liệu**.
3. Danh sách nhân viên hiện ra → chọn tên → nhập PIN. Không tạo tài khoản quản lý mới trên máy phụ.

### E3. Thu mua: một xe hàng từ đầu đến cuối
1. Trang chủ, tab **Thu mua**, ngày mặc định là hôm nay (mũi tên hai bên để đổi ngày).
2. Quản lý nhập **Giá tham chiếu** trong ngày (thanh xanh phía trên) nếu muốn xe mới tự lấy giá.
3. Bấm **Tạo xe N** → chọn **chủ hàng** (bấm nhiều người nếu xe chở hàng của nhiều chủ; hoặc gõ tên mới), **tài xế**, **loại hàng**, **nhập kho**, **nhân viên đi cân** (mặc định là người đang đăng nhập), **kiểu cân** → **Tạo Xe N**. App ghi giờ tạo và người tạo.
4. **Cân từng bao**: bấm một ô trống → bàn phím số hiện ra → gõ số kg → **Tiếp** để nhảy sang ô trống kế tiếp (đi theo cột), **Xong** để đóng. Mỗi bảng 25 ô; hết thì **Thêm bảng**. Tổng từng cột hiện màu đỏ ở dưới, tổng bảng ở góc phải, tổng xe ở thanh trên cùng.
   **Cân xe tải**: nhập **Xe vào (có hàng)**, **Xe ra (rỗng)**, số bao; nhiều chủ hàng thì chia kg cho từng người, app báo phần chưa chia.
5. Sai số: **nhấn giữ** ô khoảng nửa giây → sửa → Xong. Bấm thường vào ô đã có số sẽ không sửa được. Mọi lần sửa ghi vào **Lịch sử sửa** (icon đồng hồ) với tên người sửa, giờ, số cũ → số mới.
6. Khoá bảng khi cân xong bảng đó: bấm nút **Mở/Khoá** cạnh tên bảng. Khoá tất cả: icon ổ khoá trên cùng.
7. Trong khối của từng chủ hàng: nhập **Mẫu (g)**, **Tạp (g)** (app tự ra % tạp), **Độ (%)**, chọn **quy ước** nếu khác mặc định, nhập **Giá**. App tính trừ bì, trừ tạp, trừ độ, **thực nhận**, **thành tiền**.
8. Chụp ảnh nếu cần: thẻ **Ảnh** → **+ Chụp** → chọn loại (mẫu hàng, phiếu giấy, xe) → chụp hoặc chọn từ thư viện. Ảnh tự lên Google Drive.
9. Bấm **Xong xe** ở dưới cùng → xem tổng kết → **Xác nhận**. Các bảng bị khoá, thẻ xanh "Đã xong" hiện trên đầu. Muốn sửa lại: **nhấn giữ** thẻ "Đã xong" hoặc nút "Mở lại xe" → mở lại (có ghi lịch sử).
10. **Phiếu cân (PDF)** trong khối chủ hàng → chia sẻ qua Zalo cho đúng người. Icon chia sẻ trên cùng xuất phiếu cả xe (mỗi chủ hàng một trang).
11. Trả tiền: trong khối chủ hàng bấm **Ghi thanh toán** → số tiền (có nút *Trả hết* và cộng nhanh), tiền mặt / chuyển khoản, ghi chú → **Ghi thanh toán**. Trả làm nhiều lần cũng được; trạng thái tự chuyển *Chưa / Một phần / Đã thanh toán*. Nhấn giữ một dòng để xoá lần trả nhập nhầm.
12. Khi bốc hàng xong: gạt **Đã bốc** trên thẻ thông tin xe.

### E4. Bán hàng: một chuyến giao cho khách
1. Trang chủ bấm tab **Bán hàng** → **Tạo chuyến bán N** → chọn **khách hàng** (nhiều khách nếu giao cho nhiều người), tài xế, loại hàng, **kho xuất**, nhân viên giao, kiểu cân → **Tạo**.
2. Cân y như xe thu mua (bảng từng bao hoặc xe vào – xe ra). Nhập tạp, độ theo thoả thuận với khách (chọn quy ước phù hợp), **giá bán**.
3. **Xong xe** → **Phiếu giao hàng (PDF)** gửi khách.
4. Khách trả tiền: **Ghi thu tiền** (nhiều lần). Khách còn nợ xem ở **Công nợ → Phải thu**.
5. Tồn kho tự trừ phần đã bán theo kho xuất.

### E5. Theo dõi và quản lý
- **Công nợ** (icon ví trên trang chủ hoặc lối tắt): tab **Phải trả** (mình nợ người bán) và **Phải thu** (khách nợ mình). Bấm vào một người → từng xe còn nợ → **Thanh toán / Thu tiền** ngay tại đó, nút gọi điện.
- **Báo cáo**: chọn kỳ (ngày, tuần, tháng, năm, mũi tên lùi/tiến), lọc **Thu mua / Bán hàng / Cả hai**. Thẻ "Mua vào – bán ra" cho chênh lệch giá bình quân và ước lãi gộp. Nhóm theo ngày, đối tác, nhân viên, tài xế, loại hàng, kho. **Xuất Excel** gửi về máy tính.
- **Tồn kho**: nhập (xe thu mua) − xuất (chuyến bán + xuất khác) = tồn theo từng kho. **+ Xuất khác** cho xuất kho không qua cân (hao hụt, chuyển kho). Quản lý ghi **lệnh hedge** (lot, tấn/lot) để thấy số tấn chưa hedge.
- **Tìm xe** (kính lúp): gõ tên người bán, khách, tài xế, biển số, SĐT, ngày; lọc Mua / Bán / Đang cân / Đã xong / Còn nợ / Chưa bốc.
- **Nhắc việc** (chuông cam trên trang chủ): xe hôm trước chưa bấm xong, xe xong chưa có giá, chưa bốc, công nợ quá hạn hai chiều. Bấm từng dòng để mở xe hoặc người nợ.
- **Google Sheets** trên máy tính: trang Xe (mỗi chủ hàng một dòng), Chi tiết cân, Thanh toán, Công nợ, Xuất bán, Tồn kho, Hedge, Ảnh, Lịch sử sửa, Đối tác, Giá ngày, Kho, Loại hàng, Quy ước, Nhân viên, Tài xế. Trang **DATA** là dữ liệu gốc, không sửa tay.
- **Sao lưu**: app tự sao lưu mỗi ngày trong máy (giữ 7 bản). Thỉnh thoảng **Cài đặt → Sao lưu ra file** gửi về Zalo/Email. **Khôi phục từ file** khi đổi máy.
- **Đổi người dùng**: bấm tên ở góc trái trang chủ → Đăng xuất → chọn tên khác.

### E6. Khi không có mạng
Cân, nhập, thanh toán bình thường. Icon đám mây trên trang chủ cho biết trạng thái: xanh là đã đồng bộ, đỏ là lỗi (bấm vào để xem). Có mạng lại app tự gửi. Hai máy cùng sửa một xe: số cân lấy bản mới hơn, còn thanh toán, chủ hàng thêm và lịch sử của cả hai máy đều được giữ; xe đã bấm xong không bị máy cũ mở lại.

## Khi gặp lỗi
Chụp màn hình lỗi (hoặc copy nguyên văn dòng lỗi trong cửa sổ lệnh) và gửi cho tôi kèm bước đang làm.
