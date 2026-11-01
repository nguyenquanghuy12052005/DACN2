# DACN2 Glass Security Command Center — UI-01

One React app provides
`/dashboard`, `/demo` and `/dashboard/simulation`. UI-01a uses Vietnamese labels
and Segoe UI/Arial per the user's updated preference. UI-03b adds an opt-in
Gateway browser boundary and correlated TLS/H2 logs; backend and AI are unchanged.

## Demo trực tiếp — lưu lâu dài trong dacn2

Từ thư mục gốc chạy `node scripts/dashboard-live.cjs`. Script tự mở Chrome lab
riêng với certificate SPKI cho phép; dùng cửa sổ này cho HTTPS/HTTP2.
Luồng: Chrome→Gateway18444→NestJS13001→PostgreSQL `dacn2`; Vite5173 chỉ UI/log.
Không cần tự chạy backend/go run hoặc Docker. Không thay `.env` hay trust store.

Mở /demo để đăng ký vào các môn có sẵn: CS101, NET301, SEC401, AI402, WEB201.
Kết quả201 ghi thật; cùng mã và môn trả409 kể cả ở phiên sau. Đăng ký và số chỗ
được giữ nguyên khi Ctrl+C hoặc `node scripts/dashboard-live.cjs stop`.
Không tự thêm môn, không xoá đăng ký, không reset DB lúc bật/tắt. Chưa có lệnh
reset dữ liệu trong lát cắt này. Đóng tab không dừng server.

Mở /dashboard → Dấu vân tay: Tín hiệu kết nối có JA4/JA4_r/JA4_o/JA4_ro,
metadata H2, Akamai text/hash và request cùng connection ID. Thiếu quan sát có
thông báo. 12 feature dự kiến có tìm kiếm, ý nghĩa tiếng Việt, đơn vị dự kiến,
nguồn và lý do chưa tính; tất cả giá trị aggregate chưa có. Chưa thu dataset,
chưa xuất CSV, chưa AI/policy/autoscaling. TLS versions/ALPN/GREASE chưa có
trường JSON riêng cho UI, không đoán từ hash.

### Kiểm thử riêng, không ghi DB chính

Từ root chạy `node scripts/dashboard-live.cjs --test-db --no-browser`, rồi từ
dashboard chạy `npm run test:live`. Bộ kiểm thử từ chối ghi nếu snapshot không
phải dacn2_test. Dừng sau mỗi lượt để dọn3fixture (môn1chỗ đã được dùng hết).
`Cleanup:true` của phiên mặc định chỉ việc dừng/đối soát, không phải xoá dữ liệu.
Result/log nằm trong .local-backups/ui-live/. Lock/crash recovery xem DEPLOYMENT.md.
`npm run test:e2e` là static E2E, cần5173trống.

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
