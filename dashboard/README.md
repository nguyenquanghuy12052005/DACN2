# DACN2 Glass Security Command Center — UI-01

One React app provides
`/dashboard`, `/demo` and `/dashboard/simulation`. UI-01a uses Vietnamese labels
and Segoe UI/Arial per the user's updated preference. UI-03b adds an opt-in
Gateway browser boundary and correlated TLS/H2 logs; backend and AI are unchanged.

## Demo trực tiếp — UI-03

**UI-03b đã đổi sang Chrome gọi HTTPS trực tiếp tới Gateway.** Lệnh khởi động
vẫn như dưới; nó tự mở cửa sổ Chrome lab riêng. Dùng cửa sổ này để demo: khoá
certificate lab được cho phép riêng, không sửa Chrome chính hoặc trust store Windows.
Luồng mới: Chrome→HTTPS Gateway18444→NestJS13001→dacn2_test; Vite chỉ hiển thị UI/log.
Kết quả đăng ký có HTTP/2.0 và mã kết nối; đối chiếu mã đó ở Nhật ký/Dấu vân tay
để xem JA4 và Akamai của đúng kết nối trình duyệt. Thiếu capture được ghi rõ.
Không cần tự chạy backend/go run, không cần Docker. Ctrl+C hoặc stop command dọn
phiên. `--no-browser` dành cho QA. Certificate hết hạn cần gia hạn trước; script
không tự thay cert/key.

Đã kết nối API thật và log Gateway. Dừng server `npm run dev`
cũ nếu đang chạy, rồi từ thư mục dự án:

```powershell
cd D:\DACN2
node scripts/dashboard-live.cjs
```

Dùng hai tab tự mở trong Chrome lab: http://127.0.0.1:5173/demo để đăng ký và
http://127.0.0.1:5173/dashboard để xem số liệu/nhật ký/dấu vân tay.
Chọn môn, nhập mã giả lập và bấm **Đăng ký qua Gateway**: thành công201, đăng ký
lại cùng mã409. Môn thứ ba có1chỗ để thử hết chỗ. Số chỗ lấy từ PostgreSQL thật.
Chỉ3môn thử riêng của phiên trong dacn2_test được phép ghi; dữ liệu demo giữ nguyên.

Luồng: Chrome→HTTPS Go Gateway18444→NestJS Windows13001→PostgreSQL.
Đây là phiên native nhẹ, không cần Docker/K3s. JA4 và HTTP/2 thu từ kết nối
Chrome trực tiếp. AI/chặn/scale vẫn chưa có; ô Pod chưa có
quan sát. SSE cập nhật1s; hoàn tất/giây và p95 lấy log thật, không thay bằng mẫu
khi mất kết nối. Đăng ký không tự retry nếu chưa biết kết quả.

Dừng và dọn dữ liệu thử bằng Ctrl+C, hoặc từ terminal khác:

```powershell
node scripts/dashboard-live.cjs stop
```

Đợi thông báo Cleanup:true. Log/result/screenshot kiểm chứng nằm trong
.local-backups/ui-live/. Đóng tab không tự dừng phiên. Nếu máy tắt đột ngột, cần
kiểm tra lock/tiến trình/fixture theo DEPLOYMENT.md; không tự xoá dữ liệu khác.

`npm run test:adapter` kiểm tra adapter không bật dịch vụ. `npm run test:live`
chạy Chrome trên phiên live sạch đang mở; tạo đăng ký thật trong fixture, cần
dừng phiên sau test để dọn. `npm run test:e2e` là bộ static cần cổng5173trống.

## Bản giao diện mẫu — UI-01

Tổng quan dùng các tab Sơ đồ / Lưu lượng / Nhật ký yêu cầu / Dấu vân tay để giảm
cuộn cả trang. Chuyển tab bằng click hoặc phím mũi tên, Home/End. Các mục giải
thích AI/trạng thái có thể mở rộng. Trên1920×1080 mặc định không cần cuộn; trên
1366×768 còn khoảng48–69px cuộn theo trang; mobile vẫn cuộn tự nhiên để chữ dễ đọc.
Nguồn dữ liệu: Mẫu giao diện / Trực tiếp (chưa có). Trạng thái mẫu chỉ đổi trạng
thái xem trước; không kết nối API hoặc phát tải.

From PowerShell:

```powershell
cd D:\DACN2\dashboard
npm ci
npm run dev
```

Open http://127.0.0.1:5173/dashboard. No Docker, PostgreSQL or lab startup needed.
Ctrl+C stops the frontend server. Listener is loopback only with a strict port;
do not expose the Vite development server to LAN/public networks.

With `npm run dev` (not the live runner), use navigation to inspect three screens. The moon/sun button changes theme;
Display settings contains Reduce motion. The OS reduced-motion preference is
also honored. Mobile navigation is behind the menu button.

Mock Design displays deterministic synthetic fixtures. Overview has a Preview
states selector for loading/empty/disconnected variants. Live is selectable only
to inspect the honest unavailable state: no live transport, no automatic fallback
to mock, and no sample numbers/events/courses displayed as Live. Replay is planned.
No request to Gateway/backend is sent by any screen. Form submit previews a route
only, never persists registrations or reports a fake HTTP success. Start/Stop are
disabled and no generator/controller is installed. Topology is static in UI-01;
bounded traffic motion follows UI-02 after authorization.

```powershell
npm run lint
npm run build
npm test
npm run test:e2e
```

Browser tests use an installed Google Chrome (`channel: chrome`), not a downloaded
browser. They cover three viewports/routes, screenshots, axe accessibility scans,
theme/motion, offline provenance and disabled controls. Results/screenshots are
in ignored test-results/. `npm run preview` serves built output on loopback4173.

Dependencies use exact versions + package-lock; Vite6.4.5 is selected for the
existing Node20.20.2 host and patched6.x line. React/Vite/Tailwind/testing libraries
are MIT; Lucide ISC; Playwright Apache-2.0; axe tooling MPL-2.0
(see installed package licenses).
No external image/font assets or copied template. Official integration references:
https://v6.vite.dev/guide/ and https://tailwindcss.com/docs/installation/using-vite.
Future integration boundaries: ../docs/DASHBOARD_DATA_MAPPING.md.
